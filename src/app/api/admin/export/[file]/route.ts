import { NextRequest, NextResponse } from "next/server";
import { addDerivedVariables } from "@/lib/derived";
import { getSupabaseAdmin } from "@/lib/supabase";

type Params = { params: Promise<{ file: string }> };
type Row = Record<string, unknown>;

const exportColumns: Record<string, string[]> = {
  "respondents.csv": [
    "respondent_id",
    "submission_id",
    "created_at",
    "record_use_basis",
    "respondent_role",
    "specialty",
    "practice_setting",
    "opd_volume",
    "support_staff",
    "record_system",
    "lab_tracking",
    "referral_tracking",
    "followup_tracking",
    "communication_channel",
    "digital_maturity",
  ],
  "care_loops.csv": [
    "loop_id",
    "respondent_id",
    "respondent_role",
    "specialty",
    "practice_setting",
    "loop_number",
    "loop_code",
    "loop_family",
    "loop_type",
    "loop_specialty",
    "test_category",
    "referral_category",
    "urgency",
    "severity",
    "recommended_window",
    "recommended_window_days",
    "review_status",
    "review_day_offset",
    "contact_status",
    "contact_day_offset",
    "action_status",
    "action_day_offset",
    "followup_scheduled_status",
    "followup_scheduled_day_offset",
    "closure_status",
    "closure_day_offset",
    "audit_age_days_if_open",
    "first_receiver_role",
    "reviewer_role",
    "contact_role",
    "owner_role",
    "closer_role",
    "handoff_count",
    "tracking_method",
    "support_staff_involved",
    "loop_communication_channel",
    "clinic_load",
    "current_status",
    "patient_contacted",
    "followup_completed",
    "escalation_required",
    "emergency_referral_or_admission",
    "care_plan_changed",
    "evidence_source",
    "confidence",
    "selection_method",
    "verification_willingness",
    "record_use_basis",
    "days_to_review",
    "days_to_contact",
    "days_to_action",
    "days_to_followup_scheduled",
    "days_to_closure",
    "censored_status",
    "censored_time",
    "days_overdue",
    "positive_days_overdue",
    "urgency_weight",
    "risk_weighted_delay",
    "stall_stage",
  ],
  "event_timeline.csv": [
    "loop_id",
    "review_status",
    "review_day_offset",
    "contact_status",
    "contact_day_offset",
    "action_status",
    "action_day_offset",
    "followup_scheduled_status",
    "followup_scheduled_day_offset",
    "closure_status",
    "closure_day_offset",
    "audit_age_days_if_open",
  ],
  "workflow_path.csv": [
    "loop_id",
    "first_receiver_role",
    "reviewer_role",
    "contact_role",
    "owner_role",
    "closer_role",
    "handoff_count",
    "tracking_method",
    "support_staff_involved",
    "loop_communication_channel",
    "clinic_load",
  ],
  "resolution_outcomes.csv": [
    "loop_id",
    "current_status",
    "patient_contacted",
    "followup_completed",
    "escalation_required",
    "emergency_referral_or_admission",
    "care_plan_changed",
  ],
  "evidence_quality.csv": [
    "loop_id",
    "evidence_source",
    "confidence",
    "selection_method",
    "verification_willingness",
    "record_use_basis",
  ],
  "site_operations.csv": [
    "respondent_id",
    "abnormal_result_owner_exists",
    "referral_owner_exists",
    "unresolved_review_cadence",
    "future_export_available",
    "future_approval_path",
  ],
};

function escapeCsv(value: unknown) {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join(";") : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Row[], columns: string[]) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))].join("\n");
}

function authorized(request: NextRequest) {
  const expected = process.env.ADMIN_EXPORT_PASSWORD;
  if (!expected) return false;
  return request.headers.get("x-admin-password") === expected;
}

async function fetchTable(table: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(error.message);
  return data ?? [];
}

function mapBy<T extends Row>(rows: T[], key: string) {
  return new Map(rows.map((row) => [String(row[key]), row]));
}

async function wideCareLoopRows() {
  const [respondents, loops, timelines, paths, outcomes, evidence] = await Promise.all([
    fetchTable("respondents"),
    fetchTable("care_loops"),
    fetchTable("event_timeline"),
    fetchTable("workflow_path"),
    fetchTable("resolution_outcomes"),
    fetchTable("evidence_quality"),
  ]);
  const respondentMap = mapBy(respondents, "respondent_id");
  const timelineMap = mapBy(timelines, "loop_id");
  const pathMap = mapBy(paths, "loop_id");
  const outcomeMap = mapBy(outcomes, "loop_id");
  const evidenceMap = mapBy(evidence, "loop_id");

  return loops.map((loop) => {
    const respondent = respondentMap.get(String(loop.respondent_id)) ?? {};
    const combined = {
      ...loop,
      respondent_role: respondent.respondent_role,
      specialty: respondent.specialty,
      practice_setting: respondent.practice_setting,
      ...timelineMap.get(String(loop.loop_id)),
      ...pathMap.get(String(loop.loop_id)),
      ...outcomeMap.get(String(loop.loop_id)),
      ...evidenceMap.get(String(loop.loop_id)),
    };
    return addDerivedVariables(combined);
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Admin export password required." }, { status: 401 });
  }

  const { file } = await params;
  const columns = exportColumns[file];
  if (!columns) {
    return NextResponse.json({ error: "Unknown export file." }, { status: 404 });
  }

  try {
    const rows = file === "care_loops.csv" ? await wideCareLoopRows() : await fetchTable(file.replace(".csv", ""));
    const csv = toCsv(rows, columns);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${file}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed." },
      { status: 500 },
    );
  }
}
