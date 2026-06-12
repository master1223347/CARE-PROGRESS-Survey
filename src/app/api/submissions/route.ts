import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  careLoopSchema,
  submissionPayloadSchema,
  type SubmissionPayload,
} from "@/lib/schemas";
import { hasIdentifierRisk } from "@/lib/privacy";

const WINDOW_MS = 60_000;
const MAX_SUBMISSIONS_PER_WINDOW = 4;
const buckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimited(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_SUBMISSIONS_PER_WINDOW;
}

function toRespondentRow(payload: SubmissionPayload, respondentId: string, submissionId: string) {
  return {
    respondent_id: respondentId,
    submission_id: submissionId,
    record_use_basis: payload.consent.record_use_basis,
    confirm_no_identifiers: payload.consent.confirm_no_identifiers,
    confirm_research_only: payload.consent.confirm_research_only,
    respondent_role: payload.context.respondent_role,
    specialty: payload.context.specialty,
    practice_setting: payload.context.practice_setting,
    opd_volume: payload.context.opd_volume,
    support_staff: payload.context.support_staff,
    record_system: payload.context.record_system,
    lab_tracking: payload.context.lab_tracking,
    referral_tracking: payload.context.referral_tracking,
    followup_tracking: payload.context.followup_tracking,
    communication_channel: payload.context.communication_channel,
    digital_maturity: payload.context.digital_maturity,
  };
}

function toLoopRows(payload: SubmissionPayload, respondentId: string) {
  return payload.loops.map((loop, index) => ({
    loop_id: randomUUID(),
    respondent_id: respondentId,
    loop_number: index + 1,
    loop_code: loop.loop_code,
    loop_family: loop.loop_family,
    loop_type: loop.loop_type,
    loop_specialty: loop.loop_specialty,
    test_category: loop.test_category || null,
    referral_category: loop.referral_category || null,
    urgency: loop.urgency,
    severity: loop.severity,
    recommended_window: loop.recommended_window,
    delay_affect_care: loop.delay_affect_care,
    source: loop,
  }));
}

export async function POST(request: NextRequest) {
  const key = clientKey(request);
  if (rateLimited(key)) {
    return NextResponse.json(
      { error: "Too many submissions from this network. Please wait and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = submissionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Submission failed validation.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const riskyLoop = payload.loops.find((loop) => hasIdentifierRisk(loop.loop_code));
  if (riskyLoop) {
    return NextResponse.json(
      { error: `Loop code ${riskyLoop.loop_code} appears to contain an identifier. Use L001-style codes only.` },
      { status: 400 },
    );
  }

  for (const loop of payload.loops) {
    const loopCheck = careLoopSchema.safeParse(loop);
    if (!loopCheck.success) {
      return NextResponse.json(
        { error: `Loop ${loop.loop_code} failed validation.`, details: loopCheck.error.flatten() },
        { status: 400 },
      );
    }
  }

  const respondentId = randomUUID();
  const submissionId = randomUUID();
  const supabase = getSupabaseAdmin();
  const loops = toLoopRows(payload, respondentId);
  const baseLoops = loops.map((loop) => ({
    loop_id: loop.loop_id,
    respondent_id: loop.respondent_id,
    loop_number: loop.loop_number,
    loop_code: loop.loop_code,
    loop_family: loop.loop_family,
    loop_type: loop.loop_type,
    loop_specialty: loop.loop_specialty,
    test_category: loop.test_category,
    referral_category: loop.referral_category,
    urgency: loop.urgency,
    severity: loop.severity,
    recommended_window: loop.recommended_window,
    delay_affect_care: loop.delay_affect_care,
  }));

  const { error: respondentError } = await supabase
    .from("respondents")
    .insert(toRespondentRow(payload, respondentId, submissionId));
  if (respondentError) {
    return NextResponse.json({ error: respondentError.message }, { status: 500 });
  }

  const { error: loopError } = await supabase.from("care_loops").insert(baseLoops);
  if (loopError) {
    await supabase.from("respondents").delete().eq("respondent_id", respondentId);
    return NextResponse.json({ error: loopError.message }, { status: 500 });
  }

  const eventRows = loops.map(({ loop_id, source }) => ({
    loop_id,
    review_status: source.review_status,
    review_day_offset: source.review_day_offset,
    contact_status: source.contact_status,
    contact_day_offset: source.contact_day_offset,
    action_status: source.action_status,
    action_day_offset: source.action_day_offset,
    followup_scheduled_status: source.followup_scheduled_status,
    followup_scheduled_day_offset: source.followup_scheduled_day_offset,
    closure_status: source.closure_status,
    closure_day_offset: source.closure_day_offset,
    audit_age_days_if_open: source.audit_age_days_if_open,
  }));
  const workflowRows = loops.map(({ loop_id, source }) => ({
    loop_id,
    first_receiver_role: source.first_receiver_role,
    reviewer_role: source.reviewer_role,
    contact_role: source.contact_role,
    owner_role: source.owner_role,
    closer_role: source.closer_role,
    handoff_count: source.handoff_count,
    tracking_method: source.tracking_method,
    support_staff_involved: source.support_staff_involved,
    loop_communication_channel: source.loop_communication_channel,
    clinic_load: source.clinic_load,
  }));
  const outcomeRows = loops.map(({ loop_id, source }) => ({
    loop_id,
    current_status: source.current_status,
    patient_contacted: source.patient_contacted,
    followup_completed: source.followup_completed,
    escalation_required: source.escalation_required,
    emergency_referral_or_admission: source.emergency_referral_or_admission,
    care_plan_changed: source.care_plan_changed,
  }));
  const evidenceRows = loops.map(({ loop_id, source }) => ({
    loop_id,
    evidence_source: source.evidence_source,
    confidence: source.confidence,
    selection_method: source.selection_method,
    verification_willingness: source.verification_willingness,
    record_use_basis: payload.consent.record_use_basis,
  }));

  const { error: eventError } = await supabase.from("event_timeline").insert(eventRows);
  const { error: workflowError } = await supabase.from("workflow_path").insert(workflowRows);
  const { error: outcomeError } = await supabase.from("resolution_outcomes").insert(outcomeRows);
  const { error: evidenceError } = await supabase.from("evidence_quality").insert(evidenceRows);
  const { error: operationsError } = await supabase.from("site_operations").insert({
    respondent_id: respondentId,
    abnormal_result_owner_exists: payload.operations.abnormal_result_owner_exists,
    referral_owner_exists: payload.operations.referral_owner_exists,
    unresolved_review_cadence: payload.operations.unresolved_review_cadence,
    future_export_available: payload.operations.future_export_available,
    future_approval_path: payload.operations.future_approval_path,
  });

  const writeError = eventError || workflowError || outcomeError || evidenceError || operationsError;
  if (writeError) {
    await supabase.from("respondents").delete().eq("respondent_id", respondentId);
    return NextResponse.json({ error: writeError.message }, { status: 500 });
  }

  return NextResponse.json({
    respondent_id: respondentId,
    submission_id: submissionId,
    loop_count: loops.length,
  });
}
