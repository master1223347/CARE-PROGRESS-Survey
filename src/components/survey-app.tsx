"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  IDENTIFIER_WARNING,
  actionStatuses,
  closureStatuses,
  closerRoles,
  communicationChannels,
  confidenceOptions,
  contactRoles,
  contactStatuses,
  currentStatuses,
  digitalMaturityOptions,
  evidenceSources,
  firstReceiverRoles,
  followupScheduledStatuses,
  futureApprovalPathOptions,
  futureExportAvailableOptions,
  handoffCounts,
  loopCommunicationChannels,
  loopFamilies,
  loopSpecialties,
  loopTrackingOptions,
  loopTypes,
  opdVolumes,
  ownerExistsOptions,
  ownerRoles,
  practiceSettings,
  recordUseBasisOptions,
  referralCategories,
  recommendedWindows,
  respondentRoles,
  reviewStatuses,
  reviewerRoles,
  selectionMethods,
  severityOptions,
  specialties,
  supportStaffOptions,
  testCategories,
  trackingOptions,
  unresolvedReviewCadenceOptions,
  urgencyOptions,
  yesNoNotNeededUnknown,
  yesNoUnclear,
} from "@/lib/options";
import { identifierRiskMessage } from "@/lib/privacy";
import {
  careLoopSchema,
  consentSchema,
  contextSchema,
  operationsSchema,
  submissionPayloadSchema,
  type CareLoop,
  type Consent,
  type RespondentContext,
  type SiteOperations,
} from "@/lib/schemas";

type Step =
  | "intro"
  | "consent"
  | "how"
  | "context"
  | "loopIntro"
  | "loops"
  | "operations"
  | "review"
  | "thanks";
type LoopDraft = Omit<CareLoop, "verification_willingness"> & {
  verification_willingness: "Yes" | "No" | "Maybe" | "" | null;
};
type FormErrors = Record<string, string>;
type LoopStatus = "Not started" | "In progress" | "Complete";

const draftKey = "care-progress-survey-draft-v2";
const steps: Array<{ key: Step; label: string }> = [
  { key: "intro", label: "Start" },
  { key: "consent", label: "Consent" },
  { key: "how", label: "How it works" },
  { key: "context", label: "Context" },
  { key: "loopIntro", label: "Care loops" },
  { key: "loops", label: "Loops" },
  { key: "operations", label: "Operations" },
  { key: "review", label: "Review" },
];

const careLoopExamples = [
  "abnormal lab result",
  "abnormal imaging result",
  "abnormal pathology result",
  "specialist referral",
  "imaging referral",
  "follow-up appointment request",
  "repeat test order",
  "post-procedure follow-up",
];

const closureOffsetStatuses = ["Closed", "Escalated", "Lost to follow-up", "Closed as no action needed"];

function emptyLoop(index: number): LoopDraft {
  const abnormalResultLoop = index < 3;
  return {
    loop_code: `L${String(index + 1).padStart(3, "0")}`,
    loop_family: abnormalResultLoop ? "Abnormal diagnostic result" : "Referral or follow-up",
    loop_type: abnormalResultLoop ? "Abnormal lab" : "Specialist referral",
    loop_specialty: "General medicine",
    test_category: abnormalResultLoop ? "HbA1c" : "N/A",
    referral_category: abnormalResultLoop ? "N/A" : "Cardiology",
    urgency: "Routine",
    severity: "Mild",
    recommended_window: "4-7 days",
    delay_affect_care: "Unclear",
    review_status: "Unknown",
    review_day_offset: null,
    contact_status: "Unknown",
    contact_day_offset: null,
    action_status: "Unknown",
    action_day_offset: null,
    followup_scheduled_status: "Unknown",
    followup_scheduled_day_offset: null,
    closure_status: "Unknown",
    closure_day_offset: null,
    audit_age_days_if_open: null,
    first_receiver_role: "Unknown",
    reviewer_role: "Unknown",
    contact_role: "Unknown",
    owner_role: "Unknown",
    closer_role: "Unknown",
    handoff_count: "Unknown",
    tracking_method: "Unknown",
    support_staff_involved: "Unclear",
    loop_communication_channel: "Unknown",
    clinic_load: "Unknown",
    current_status: "Unknown",
    patient_contacted: "Unknown",
    followup_completed: "Unknown",
    escalation_required: "Unclear",
    emergency_referral_or_admission: "Unclear",
    care_plan_changed: "Unclear",
    evidence_source: "Other",
    confidence: "Medium",
    selection_method: "Most recent consecutive loops",
    verification_willingness: "",
  };
}

const initialContext: RespondentContext = {
  respondent_role: "Physician",
  specialty: "General medicine",
  practice_setting: "Solo private clinic",
  opd_volume: "Unknown",
  support_staff: ["None"],
  record_system: "Mixed",
  lab_tracking: "Unknown",
  referral_tracking: "Unknown",
  followup_tracking: "Unknown",
  communication_channel: "Phone",
  digital_maturity: 2,
};

const initialOperations: SiteOperations = {
  abnormal_result_owner_exists: "Unknown",
  referral_owner_exists: "Unknown",
  unresolved_review_cadence: "Unknown",
  future_export_available: "unknown",
  future_approval_path: "unknown",
};

function errorsFromZod(error: z.ZodError) {
  const errors: FormErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    errors[key || "form"] = friendlyErrorMessage(key, issue.message);
  }
  return errors;
}

function friendlyErrorMessage(key: string, message: string) {
  if (key.includes("day_offset") || key === "audit_age_days_if_open") {
    if (message.toLowerCase().includes("number") || message.toLowerCase().includes("nan")) {
      return "Please enter a whole number of days, such as 0, 3, or 7.";
    }
    if (message.toLowerCase().includes("greater than or equal")) {
      return "Day offsets cannot be negative. Use 0 for the same day.";
    }
  }
  if (message.includes("Invalid input")) return "Please choose one of the listed options.";
  return message;
}

function validate<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? {} : errorsFromZod(result.error);
}

function hasRequiredEvidence(loop: LoopDraft) {
  return Boolean(loop.evidence_source && loop.confidence && loop.selection_method);
}

export function SurveyApp() {
  const [step, setStep] = useState<Step>("intro");
  const [editingLoop, setEditingLoop] = useState<number | null>(null);
  const [savedLoops, setSavedLoops] = useState<number[]>([]);
  const [consent, setConsent] = useState<Consent>({
    confirm_no_identifiers: false as never,
    confirm_research_only: false as never,
    record_use_basis: "Mixed records and memory",
  });
  const [context, setContext] = useState<RespondentContext>(initialContext);
  const [loops, setLoops] = useState<LoopDraft[]>(() => Array.from({ length: 6 }, (_, index) => emptyLoop(index)));
  const [operations, setOperations] = useState<SiteOperations>(initialOperations);
  const [finalNoIdentifiers, setFinalNoIdentifiers] = useState(false);
  const [honeypot] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitStatus, setSubmitStatus] = useState("");
  const [submissionId, setSubmissionId] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      window.setTimeout(() => {
        if (draft.step) setStep(draft.step);
        if (draft.consent) setConsent(draft.consent);
        if (draft.context) setContext(draft.context);
        if (Array.isArray(draft.loops) && draft.loops.length >= 6) setLoops(draft.loops);
        if (Array.isArray(draft.savedLoops)) setSavedLoops(draft.savedLoops);
        if (draft.operations) setOperations(draft.operations);
        if (typeof draft.finalNoIdentifiers === "boolean") setFinalNoIdentifiers(draft.finalNoIdentifiers);
      }, 0);
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      draftKey,
      JSON.stringify({ step, consent, context, loops, savedLoops, operations, finalNoIdentifiers }),
    );
  }, [step, consent, context, loops, savedLoops, operations, finalNoIdentifiers]);

  const loopValidity = useMemo(() => loops.map((loop) => careLoopSchema.safeParse(loop).success), [loops]);
  const loopStatuses = useMemo(
    () =>
      loops.map((_, index): LoopStatus => {
        if (savedLoops.includes(index) && loopValidity[index]) return "Complete";
        if (savedLoops.includes(index) || editingLoop === index) return "In progress";
        return "Not started";
      }),
    [editingLoop, loopValidity, loops, savedLoops],
  );
  const completeRequiredLoops = loopStatuses.slice(0, 6).filter((status) => status === "Complete").length;
  const submissionLoops = loops.filter((_, index) => index < 6 || loopStatuses[index] === "Complete");
  const allFamilies = new Set(loops.slice(0, 6).map((loop) => loop.loop_family));
  const nextRequiredLoop = Math.max(0, loopStatuses.slice(0, 6).findIndex((status) => status !== "Complete"));
  const nextLoopIndex = nextRequiredLoop === -1 ? 0 : nextRequiredLoop;
  const evidenceReady = submissionLoops.every(hasRequiredEvidence);

  function goTo(nextStep: Step) {
    setErrors({});
    setSubmitStatus("");
    setStep(nextStep);
    setEditingLoop(null);
  }

  function advanceFromConsent() {
    const nextErrors = validate(consentSchema, consent);
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) goTo("how");
  }

  function advanceFromContext() {
    const nextErrors = validate(contextSchema, context);
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) goTo("loopIntro");
  }

  function saveLoop(index: number, mode: "dashboard" | "next") {
    const result = careLoopSchema.safeParse(loops[index]);
    if (!result.success) {
      setSavedLoops((current) => (current.includes(index) ? current : [...current, index]));
      setErrors(errorsFromZod(result.error));
      return;
    }

    setSavedLoops((current) => (current.includes(index) ? current : [...current, index]));
    setErrors({});

    if (mode === "next" && index + 1 < loops.length) {
      setEditingLoop(index + 1);
      return;
    }

    setEditingLoop(null);
  }

  function advanceFromOperations() {
    const nextErrors = validate(operationsSchema, operations);
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) goTo("review");
  }

  async function submit() {
    if (completeRequiredLoops < 6) {
      setSubmitStatus("You can submit after 6 complete loops. Extra loops are optional.");
      return;
    }

    const payload = {
      consent,
      context,
      loops: submissionLoops,
      operations,
      final_no_identifiers: finalNoIdentifiers,
      honeypot,
    };
    const parsed = submissionPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(errorsFromZod(parsed.error));
      setSubmitStatus("Please correct the highlighted fields before submitting.");
      return;
    }
    setSubmitStatus("Submitting secure de-identified audit...");
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSubmitStatus(body.error || "Submission failed. Please try again.");
      return;
    }
    window.localStorage.removeItem(draftKey);
    setSubmissionId(body.submission_id || "");
    goTo("thanks");
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-8">
        <Header step={step} completeLoops={completeRequiredLoops} />
        {step !== "thanks" ? <Progress current={step} /> : null}

        {step === "intro" ? <Intro onStart={() => goTo("consent")} /> : null}

        {step === "consent" ? (
          <Screen title="Consent and de-identification" eyebrow="Step 1" description="This research form uses loop codes and broad role categories only. No patient identifiers or clinical documents should be entered.">
            <PrivacyReminder />
            <FieldCard title="Before you begin" description="Both confirmations are required to continue.">
              <Checkbox
                checked={Boolean(consent.confirm_no_identifiers)}
                label="I confirm that I will not enter patient names, phone numbers, addresses, Aadhaar numbers, medical record numbers, prescription images, lab-report photos, WhatsApp screenshots, raw clinical notes, or other identifiable information."
                onChange={(checked) => setConsent({ ...consent, confirm_no_identifiers: checked as true })}
              />
              <Checkbox
                checked={Boolean(consent.confirm_research_only)}
                label="I understand this is a de-identified research audit of outpatient care-loop progression, not a doctor performance evaluation and not a clinical decision-making tool."
                onChange={(checked) => setConsent({ ...consent, confirm_research_only: checked as true })}
              />
              <SelectField
                error={errors.record_use_basis}
                helper="Records are preferred. Memory is acceptable when records are unavailable; mark confidence honestly later."
                label="Are you using clinic records where possible?"
                options={recordUseBasisOptions}
                value={consent.record_use_basis}
                onChange={(value) => setConsent({ ...consent, record_use_basis: value as Consent["record_use_basis"] })}
              />
              <ErrorText message={errors.confirm_no_identifiers || errors.confirm_research_only || errors.form} />
            </FieldCard>
            <StickyNav back={() => goTo("intro")} next={advanceFromConsent} nextLabel="Continue" />
          </Screen>
        ) : null}

        {step === "how" ? <HowThisWorks onBack={() => goTo("consent")} onNext={() => goTo("context")} /> : null}

        {step === "context" ? (
          <Screen title="Respondent and site context" eyebrow="Step 3" description="A short context module helps interpret loop timing by role, clinic setting, tracking systems, and digital maturity.">
            <PrivacyReminder compact />
            <FieldCard title="Respondent and clinic" description="Choose the best matching category. Do not enter staff names.">
              <FieldGrid>
                <SelectField label="Respondent role" options={respondentRoles} value={context.respondent_role} onChange={(value) => setContext({ ...context, respondent_role: value as RespondentContext["respondent_role"] })} error={errors.respondent_role} />
                <SelectField label="Specialty or service area" options={specialties} value={context.specialty} onChange={(value) => setContext({ ...context, specialty: value as RespondentContext["specialty"] })} error={errors.specialty} />
                <SelectField label="Practice setting" options={practiceSettings} value={context.practice_setting} onChange={(value) => setContext({ ...context, practice_setting: value as RespondentContext["practice_setting"] })} error={errors.practice_setting} />
                <SelectField label="Average outpatient volume per day" options={opdVolumes} value={context.opd_volume} onChange={(value) => setContext({ ...context, opd_volume: value as RespondentContext["opd_volume"] })} error={errors.opd_volume} />
              </FieldGrid>
            </FieldCard>
            <FieldCard title="Tracking and communication" description="These fields describe the usual site setup, not an individual patient.">
              <FieldGrid>
                <SelectField label="Main record system" options={["Paper", "EHR", "Clinic software", "WhatsApp/photos", "Mixed", "Other"]} value={context.record_system} onChange={(value) => setContext({ ...context, record_system: value as RespondentContext["record_system"] })} error={errors.record_system} />
                <SelectField label="Lab/result tracking method" options={trackingOptions} value={context.lab_tracking} onChange={(value) => setContext({ ...context, lab_tracking: value as RespondentContext["lab_tracking"] })} error={errors.lab_tracking} />
                <SelectField label="Referral tracking method" options={trackingOptions} value={context.referral_tracking} onChange={(value) => setContext({ ...context, referral_tracking: value as RespondentContext["referral_tracking"] })} error={errors.referral_tracking} />
                <SelectField label="Follow-up tracking method" options={trackingOptions} value={context.followup_tracking} onChange={(value) => setContext({ ...context, followup_tracking: value as RespondentContext["followup_tracking"] })} error={errors.followup_tracking} />
                <SelectField label="Main patient communication channel" options={communicationChannels} value={context.communication_channel} onChange={(value) => setContext({ ...context, communication_channel: value as RespondentContext["communication_channel"] })} error={errors.communication_channel} />
                <SelectField label="Digital maturity score" options={digitalMaturityOptions} value={digitalMaturityOptions[context.digital_maturity - 1]} onChange={(value) => setContext({ ...context, digital_maturity: Number(value.charAt(0)) })} error={errors.digital_maturity} />
              </FieldGrid>
              <CheckboxGroup
                label="Support staff usually available"
                options={supportStaffOptions}
                values={context.support_staff}
                onChange={(values) => setContext({ ...context, support_staff: values as RespondentContext["support_staff"] })}
                error={errors.support_staff}
              />
            </FieldCard>
            <StickyNav back={() => goTo("how")} next={advanceFromContext} nextLabel="Continue" />
          </Screen>
        ) : null}

        {step === "loopIntro" ? (
          <CareLoopIntro onBack={() => goTo("context")} onNext={() => goTo("loops")} />
        ) : null}

        {step === "loops" && editingLoop == null ? (
          <LoopDashboard
            allFamilies={allFamilies}
            completeRequiredLoops={completeRequiredLoops}
            loopStatuses={loopStatuses}
            loops={loops}
            nextLoopIndex={nextLoopIndex}
            onAddLoop={() => setLoops([...loops, emptyLoop(loops.length)])}
            onBack={() => goTo("loopIntro")}
            onContinue={() => goTo("operations")}
            onOpenLoop={(index) => {
              setErrors({});
              setEditingLoop(index);
            }}
          />
        ) : null}

        {step === "loops" && editingLoop != null ? (
          <LoopEditor
            errors={errors}
            index={editingLoop}
            loop={loops[editingLoop]}
            status={loopStatuses[editingLoop]}
            onBack={() => {
              setErrors({});
              setEditingLoop(null);
            }}
            onChange={(loop) => setLoops(loops.map((item, index) => (index === editingLoop ? loop : item)))}
            onRemove={(index) => {
              if (index < 6) return;
              setLoops(loops.filter((_, loopIndex) => loopIndex !== index));
              setSavedLoops(savedLoops.filter((loopIndex) => loopIndex !== index).map((loopIndex) => (loopIndex > index ? loopIndex - 1 : loopIndex)));
              setErrors({});
              setEditingLoop(null);
            }}
            onSave={(mode) => saveLoop(editingLoop, mode)}
          />
        ) : null}

        {step === "operations" ? (
          <Screen title="Operational readiness and verification" eyebrow="Step 8" description="These questions describe clinic-level follow-up structure and future de-identified data feasibility.">
            <PrivacyReminder compact />
            <FieldCard title="Operational structure" description="Use role/category answers only. Do not enter staff names.">
              <FieldGrid>
                <SelectField label="Named person responsible for abnormal result follow-up?" options={ownerExistsOptions} value={operations.abnormal_result_owner_exists} onChange={(value) => setOperations({ ...operations, abnormal_result_owner_exists: value as SiteOperations["abnormal_result_owner_exists"] })} error={errors.abnormal_result_owner_exists} />
                <SelectField label="Named person responsible for referral completion?" options={ownerExistsOptions} value={operations.referral_owner_exists} onChange={(value) => setOperations({ ...operations, referral_owner_exists: value as SiteOperations["referral_owner_exists"] })} error={errors.referral_owner_exists} />
                <SelectField label="Are unresolved loops reviewed at end of day/week?" options={unresolvedReviewCadenceOptions} value={operations.unresolved_review_cadence} onChange={(value) => setOperations({ ...operations, unresolved_review_cadence: value as SiteOperations["unresolved_review_cadence"] })} error={errors.unresolved_review_cadence} />
                <SelectField label="Can the clinic export de-identified logs in the future?" options={futureExportAvailableOptions} value={operations.future_export_available} onChange={(value) => setOperations({ ...operations, future_export_available: value as SiteOperations["future_export_available"] })} error={errors.future_export_available} />
                <SelectField label="Who would approve future data sharing?" options={futureApprovalPathOptions} value={operations.future_approval_path} onChange={(value) => setOperations({ ...operations, future_approval_path: value as SiteOperations["future_approval_path"] })} error={errors.future_approval_path} />
              </FieldGrid>
            </FieldCard>
            <StickyNav back={() => goTo("loops")} next={advanceFromOperations} nextLabel="Review submission" />
          </Screen>
        ) : null}

        {step === "review" ? (
          <ReviewScreen
            completeRequiredLoops={completeRequiredLoops}
            contextComplete={!Object.keys(validate(contextSchema, context)).length}
            evidenceReady={evidenceReady}
            finalNoIdentifiers={finalNoIdentifiers}
            loopStatuses={loopStatuses}
            operationsComplete={!Object.keys(validate(operationsSchema, operations)).length}
            submitStatus={submitStatus}
            totalLoops={submissionLoops.length}
            errors={errors}
            onBack={() => goTo("operations")}
            onConfirm={setFinalNoIdentifiers}
            onSubmit={submit}
          />
        ) : null}

        {step === "thanks" ? <ThankYou submissionId={submissionId} /> : null}
      </div>
    </main>
  );
}

function Header({ step, completeLoops }: { step: Step; completeLoops: number }) {
  const label = steps.find((item) => item.key === step)?.label ?? "Complete";
  return (
    <header className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">CARE-PROGRESS India</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Outpatient Care-Loop Progression Audit
          </h1>
          <p className="mt-2 text-sm text-slate-600">Current step: {label}. Required loops complete: {completeLoops}/6.</p>
        </div>
        <a className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-blue-700 hover:border-blue-200 hover:bg-blue-50" href="/admin">
          Admin export
        </a>
      </div>
    </header>
  );
}

function Progress({ current }: { current: Step }) {
  const currentIndex = Math.max(0, steps.findIndex((item) => item.key === current));
  const progressPercent = ((currentIndex + 1) / steps.length) * 100;
  return (
    <nav aria-label="Survey progress" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
        <span>Step {currentIndex + 1} of {steps.length}</span>
        <span>{steps[currentIndex]?.label}</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-700" style={{ width: `${progressPercent}%` }} />
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((item, index) => (
          <li
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${
              index <= currentIndex
                ? "bg-blue-700 text-white"
                : "border border-slate-200 bg-white text-slate-500"
            }`}
            key={item.key}
          >
            {item.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <Screen
      title="CARE-PROGRESS India: Outpatient Care-Loop Progression Audit"
      eyebrow="Clinical research form"
      description="A de-identified survey for understanding how outpatient tasks move through review, contact, action, escalation, and closure."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Estimated time" value="13-19 minutes" />
        <MetricCard label="Required work" value="6 loop audits" />
        <MetricCard label="Privacy" value="No identifiers" />
      </div>
      <FieldCard title="What you will do" description="Use records where possible. Each row should describe one specific recent loop, not what usually happens.">
        <p className="text-sm leading-6 text-slate-700">
          CARE-PROGRESS India studies how time-sensitive outpatient care loops progress through real clinical workflows.
          You will first confirm de-identification rules, then complete site context and 6 recent loop audits.
        </p>
        <p className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
          A care loop is one specific clinical task that began at a known point and should later be reviewed,
          acted on, escalated, closed, or marked as no action needed.
        </p>
        <PrivacyReminder compact />
      </FieldCard>
      <StickyNav next={onStart} nextLabel="Start de-identified audit" />
    </Screen>
  );
}

function HowThisWorks({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <Screen
      title="You'll audit 6 recent care loops"
      eyebrow="How this works"
      description="A care loop is a clinical task that started at one point and should later be reviewed, acted on, escalated, closed, or marked as no action needed."
    >
      <FieldCard title="Examples of eligible care loops" description="Choose specific recent examples from the last 30-90 days.">
        <div className="grid gap-2 sm:grid-cols-2">
          {careLoopExamples.map((example) => (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" key={example}>
              {example}
            </div>
          ))}
        </div>
      </FieldCard>
      <FieldCard title="Selection rule" description="This keeps the research dataset interpretable.">
        <p className="text-sm leading-6 text-slate-700">
          Please choose recent specific loops from the last 30-90 days. Use records where possible. Do not choose only
          memorable, severe, successful, or failed cases.
        </p>
      </FieldCard>
      <StickyNav back={onBack} next={onNext} nextLabel="Continue to context" />
    </Screen>
  );
}

function CareLoopIntro({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <Screen
      title="Before Loop 1"
      eyebrow="Care-loop audit"
      description="Now enter one recent care loop at a time. Use records where possible. Each loop should take about 2 minutes."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FieldCard title="Recommended mix" description="This is preferred but not blocking.">
          <p className="text-sm leading-6 text-slate-700">Ideally: 3 abnormal diagnostic result loops + 3 referral/follow-up loops.</p>
        </FieldCard>
        <FieldCard title="Helpful definitions" description="These terms appear in the loop form.">
          <Definition term="Index event" text="the day the loop began, such as when a result became available or a referral was created" />
          <Definition term="Closure" text="the loop was resolved, escalated, completed, or explicitly marked as no action needed" />
          <Definition term="Handoff" text="the loop moved from one person or role to another" />
          <Definition term="Evidence source" text="what you used to answer this row, such as chart, lab log, referral register, or memory" />
        </FieldCard>
      </div>
      <StickyNav back={onBack} next={onNext} nextLabel="Open loop dashboard" />
    </Screen>
  );
}

function LoopDashboard({
  allFamilies,
  completeRequiredLoops,
  loopStatuses,
  loops,
  nextLoopIndex,
  onAddLoop,
  onBack,
  onContinue,
  onOpenLoop,
}: {
  allFamilies: Set<string>;
  completeRequiredLoops: number;
  loopStatuses: LoopStatus[];
  loops: LoopDraft[];
  nextLoopIndex: number;
  onAddLoop: () => void;
  onBack: () => void;
  onContinue: () => void;
  onOpenLoop: (index: number) => void;
}) {
  return (
    <Screen
      title="Care-loop dashboard"
      eyebrow="6 required loops"
      description="Complete one card at a time. You can submit after 6 loops. Extra loops are optional."
    >
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-950">Ideally: 3 abnormal diagnostic result loops + 3 referral/follow-up loops</p>
            <p className="mt-1 text-sm text-blue-900">Use most recent consecutive eligible loops from the last 30-90 days.</p>
          </div>
          <button className="h-12 rounded-full bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800" onClick={() => onOpenLoop(nextLoopIndex)} type="button">
            {completeRequiredLoops === 0 ? "Start Loop 1" : completeRequiredLoops < 6 ? `Continue Loop ${nextLoopIndex + 1}` : "Review loops"}
          </button>
        </div>
      </div>
      {allFamilies.size === 1 ? <Notice>Reminder: include both loop families when possible. This is not blocking.</Notice> : null}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {loops.map((loop, index) => (
          <button
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            key={`${loop.loop_code}-${index}`}
            onClick={() => onOpenLoop(index)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Loop {index + 1}</p>
                <p className="mt-1 text-xs text-slate-500">{index < 6 ? "Required" : "Optional"}</p>
              </div>
              <StatusBadge status={loopStatuses[index]} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-800">{loop.loop_family}</p>
            <p className="mt-1 text-sm text-slate-500">{loop.loop_type}</p>
            <p className="mt-4 text-xs font-semibold text-blue-700">
              {loopStatuses[index] === "Not started" ? `Start Loop ${index + 1}` : `Edit Loop ${index + 1}`}
            </p>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="h-12 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={completeRequiredLoops < 6 || loops.length >= 10} onClick={onAddLoop} type="button">
          Add optional loop
        </button>
        <button className="h-12 rounded-full bg-blue-700 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={completeRequiredLoops < 6} onClick={onContinue} type="button">
          Continue after 6 complete loops ({completeRequiredLoops}/6)
        </button>
      </div>
      <StickyNav back={onBack} />
    </Screen>
  );
}

function LoopEditor({
  errors,
  index,
  loop,
  status,
  onBack,
  onChange,
  onRemove,
  onSave,
}: {
  errors: FormErrors;
  index: number;
  loop: LoopDraft;
  status: LoopStatus;
  onBack: () => void;
  onChange: (loop: LoopDraft) => void;
  onRemove: (index: number) => void;
  onSave: (mode: "dashboard" | "next") => void;
}) {
  const riskMessage = identifierRiskMessage(loop.loop_code);

  function update<K extends keyof LoopDraft>(key: K, value: LoopDraft[K]) {
    const next = { ...loop, [key]: value };
    if (key === "loop_family") {
      next.test_category = value === "Abnormal diagnostic result" ? "HbA1c" : "N/A";
      next.referral_category = value === "Referral or follow-up" ? "Cardiology" : "N/A";
      next.loop_type = value === "Abnormal diagnostic result" ? "Abnormal lab" : "Specialist referral";
    }
    if (key === "review_status" && value !== "Reviewed") next.review_day_offset = null;
    if (key === "contact_status" && value !== "Contacted") next.contact_day_offset = null;
    if (key === "action_status" && value !== "Action documented") next.action_day_offset = null;
    if (key === "followup_scheduled_status" && value !== "Scheduled") next.followup_scheduled_day_offset = null;
    if (key === "closure_status") {
      if (!closureOffsetStatuses.includes(String(value))) next.closure_day_offset = null;
      if (value !== "Still open") next.audit_age_days_if_open = null;
    }
    onChange(next);
  }

  return (
    <Screen
      title={`Loop ${index + 1}: one recent care loop`}
      eyebrow={index < 6 ? "Required loop" : "Optional loop"}
      description="Use records where possible. This should describe one specific recent loop, not the clinic's usual process."
    >
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">Current card status</p>
          <p className="text-sm text-slate-500">Save this loop when the required fields are complete.</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <PrivacyReminder compact />

      <FieldCard title="A. Loop basics" description="Identify the loop without using a patient identifier.">
        <FieldGrid>
          <TextField label="Loop code" value={loop.loop_code} onChange={(value) => update("loop_code", value)} error={errors.loop_code || riskMessage} />
          <SelectField label="Loop family" options={loopFamilies} value={loop.loop_family} onChange={(value) => update("loop_family", value as LoopDraft["loop_family"])} error={errors.loop_family} />
          <SelectField label="Specific loop type" options={loopTypes} value={loop.loop_type} onChange={(value) => update("loop_type", value as LoopDraft["loop_type"])} error={errors.loop_type} />
          <SelectField label="Specialty involved" options={loopSpecialties} value={loop.loop_specialty} onChange={(value) => update("loop_specialty", value as LoopDraft["loop_specialty"])} error={errors.loop_specialty} />
          {loop.loop_family === "Abnormal diagnostic result" ? <SelectField label="Test category" options={testCategories} value={loop.test_category || "N/A"} onChange={(value) => update("test_category", value as LoopDraft["test_category"])} error={errors.test_category} /> : null}
          {loop.loop_family === "Referral or follow-up" ? <SelectField label="Referral/follow-up category" options={referralCategories} value={loop.referral_category || "N/A"} onChange={(value) => update("referral_category", value as LoopDraft["referral_category"])} error={errors.referral_category} /> : null}
        </FieldGrid>
      </FieldCard>

      <FieldCard title="B. Clinical time-sensitivity" description="These fields make delays clinically interpretable.">
        <FieldGrid>
          <SelectField helper="How time-sensitive was this loop clinically?" label="Clinical urgency" options={urgencyOptions} value={loop.urgency} onChange={(value) => update("urgency", value as LoopDraft["urgency"])} error={errors.urgency} />
          <SelectField label="Clinical severity" options={severityOptions} value={loop.severity} onChange={(value) => update("severity", value as LoopDraft["severity"])} error={errors.severity} />
          <SelectField helper="How quickly should this loop ideally have been resolved?" label="Recommended closure window" options={recommendedWindows} value={loop.recommended_window} onChange={(value) => update("recommended_window", value as LoopDraft["recommended_window"])} error={errors.recommended_window} />
          <SelectField label="Could delay plausibly affect care?" options={yesNoUnclear} value={loop.delay_affect_care} onChange={(value) => update("delay_affect_care", value as LoopDraft["delay_affect_care"])} error={errors.delay_affect_care} />
        </FieldGrid>
      </FieldCard>

      <TimelineExplainer />
      <FieldCard title="C. Timeline" description="Use relative day offsets from the day the loop began.">
        <FieldGrid>
          <SelectField label="Clinician review status" options={reviewStatuses} value={loop.review_status} onChange={(value) => update("review_status", value as LoopDraft["review_status"])} error={errors.review_status} />
          {loop.review_status === "Reviewed" ? <NumberField label="Review day offset" value={loop.review_day_offset} onChange={(value) => update("review_day_offset", value)} error={errors.review_day_offset} /> : null}
          <SelectField label="Patient contact status" options={contactStatuses} value={loop.contact_status} onChange={(value) => update("contact_status", value as LoopDraft["contact_status"])} error={errors.contact_status} />
          {loop.contact_status === "Contacted" ? <NumberField label="Contact day offset" value={loop.contact_day_offset} onChange={(value) => update("contact_day_offset", value)} error={errors.contact_day_offset} /> : null}
          <SelectField label="Documented action status" options={actionStatuses} value={loop.action_status} onChange={(value) => update("action_status", value as LoopDraft["action_status"])} error={errors.action_status} />
          {loop.action_status === "Action documented" ? <NumberField label="Action day offset" value={loop.action_day_offset} onChange={(value) => update("action_day_offset", value)} error={errors.action_day_offset} /> : null}
          <SelectField label="Follow-up scheduled status" options={followupScheduledStatuses} value={loop.followup_scheduled_status} onChange={(value) => update("followup_scheduled_status", value as LoopDraft["followup_scheduled_status"])} error={errors.followup_scheduled_status} />
          {loop.followup_scheduled_status === "Scheduled" ? <NumberField label="Follow-up scheduled day offset" value={loop.followup_scheduled_day_offset} onChange={(value) => update("followup_scheduled_day_offset", value)} error={errors.followup_scheduled_day_offset} /> : null}
          <SelectField helper="What is the current status of this loop?" label="Loop closure status" options={closureStatuses} value={loop.closure_status} onChange={(value) => update("closure_status", value as LoopDraft["closure_status"])} error={errors.closure_status} />
          {closureOffsetStatuses.includes(loop.closure_status) ? <NumberField label="Closure day offset" value={loop.closure_day_offset} onChange={(value) => update("closure_day_offset", value)} error={errors.closure_day_offset} /> : null}
          {loop.closure_status === "Still open" ? <NumberField label="Audit age in days" value={loop.audit_age_days_if_open} onChange={(value) => update("audit_age_days_if_open", value)} error={errors.audit_age_days_if_open} /> : null}
        </FieldGrid>
      </FieldCard>

      <FieldCard title="D. Workflow path" description="Roles are enough. Do not enter staff names. A handoff means the loop moved from one person or role to another.">
        <FieldGrid>
          <SelectField label="Who first received or noticed the loop?" options={firstReceiverRoles} value={loop.first_receiver_role} onChange={(value) => update("first_receiver_role", value as LoopDraft["first_receiver_role"])} error={errors.first_receiver_role} />
          <SelectField label="Who reviewed it clinically?" options={reviewerRoles} value={loop.reviewer_role} onChange={(value) => update("reviewer_role", value as LoopDraft["reviewer_role"])} error={errors.reviewer_role} />
          <SelectField label="Who contacted the patient?" options={contactRoles} value={loop.contact_role} onChange={(value) => update("contact_role", value as LoopDraft["contact_role"])} error={errors.contact_role} />
          <SelectField helper="Who was mainly responsible for making sure the loop reached closure?" label="Owner role" options={ownerRoles} value={loop.owner_role} onChange={(value) => update("owner_role", value as LoopDraft["owner_role"])} error={errors.owner_role} />
          <SelectField label="Who closed the loop?" options={closerRoles} value={loop.closer_role} onChange={(value) => update("closer_role", value as LoopDraft["closer_role"])} error={errors.closer_role} />
          <SelectField helper="A handoff means the loop moved from one person or role to another." label="Number of handoffs" options={handoffCounts} value={loop.handoff_count} onChange={(value) => update("handoff_count", value as LoopDraft["handoff_count"])} error={errors.handoff_count} />
          <SelectField label="Tracking method for this loop" options={loopTrackingOptions} value={loop.tracking_method} onChange={(value) => update("tracking_method", value as LoopDraft["tracking_method"])} error={errors.tracking_method} />
          <SelectField label="Support staff involved?" options={yesNoUnclear} value={loop.support_staff_involved} onChange={(value) => update("support_staff_involved", value as LoopDraft["support_staff_involved"])} error={errors.support_staff_involved} />
          <SelectField label="Main communication channel" options={loopCommunicationChannels} value={loop.loop_communication_channel} onChange={(value) => update("loop_communication_channel", value as LoopDraft["loop_communication_channel"])} error={errors.loop_communication_channel} />
          <SelectField required={false} label="Approximate outpatient load that day" options={opdVolumes} value={loop.clinic_load || "Unknown"} onChange={(value) => update("clinic_load", value as LoopDraft["clinic_load"])} error={errors.clinic_load} />
        </FieldGrid>
      </FieldCard>

      <FieldCard title="E. Resolution" description="Use documented status where available. This is a clinical consequence proxy, not blame scoring.">
        <FieldGrid>
          <SelectField label="Current status" options={currentStatuses} value={loop.current_status} onChange={(value) => update("current_status", value as LoopDraft["current_status"])} error={errors.current_status} />
          <SelectField label="Was the patient successfully contacted?" options={yesNoNotNeededUnknown} value={loop.patient_contacted} onChange={(value) => update("patient_contacted", value as LoopDraft["patient_contacted"])} error={errors.patient_contacted} />
          <SelectField label="Was follow-up completed?" options={yesNoNotNeededUnknown} value={loop.followup_completed} onChange={(value) => update("followup_completed", value as LoopDraft["followup_completed"])} error={errors.followup_completed} />
          <SelectField label="Was urgent escalation required?" options={yesNoUnclear} value={loop.escalation_required} onChange={(value) => update("escalation_required", value as LoopDraft["escalation_required"])} error={errors.escalation_required} />
          <SelectField label="Was emergency referral/admission documented?" options={yesNoUnclear} value={loop.emergency_referral_or_admission} onChange={(value) => update("emergency_referral_or_admission", value as LoopDraft["emergency_referral_or_admission"])} error={errors.emergency_referral_or_admission} />
          <SelectField label="Was the care plan changed because of this loop?" options={yesNoUnclear} value={loop.care_plan_changed} onChange={(value) => update("care_plan_changed", value as LoopDraft["care_plan_changed"])} error={errors.care_plan_changed} />
        </FieldGrid>
      </FieldCard>

      <FieldCard title="F. Evidence quality" description="Evidence source means what you used to answer this row, such as chart, lab log, referral register, or memory.">
        <FieldGrid>
          <SelectField helper="This helps separate record-backed rows from memory-backed rows." label="Evidence source" options={evidenceSources} value={loop.evidence_source} onChange={(value) => update("evidence_source", value as LoopDraft["evidence_source"])} error={errors.evidence_source} />
          <SelectField label="Confidence" options={confidenceOptions} value={loop.confidence} onChange={(value) => update("confidence", value as LoopDraft["confidence"])} error={errors.confidence} />
          <SelectField label="Selection method" options={selectionMethods} value={loop.selection_method} onChange={(value) => update("selection_method", value as LoopDraft["selection_method"])} error={errors.selection_method} />
          <SelectField required={false} label="May a de-identified subset be verified later?" options={["", "Yes", "No", "Maybe"]} value={loop.verification_willingness || ""} onChange={(value) => update("verification_willingness", value as LoopDraft["verification_willingness"])} error={errors.verification_willingness} />
        </FieldGrid>
      </FieldCard>

      <StickyNav
        back={onBack}
        extra={index >= 6 ? <button className="h-12 rounded-full border border-red-200 bg-white px-5 text-sm font-semibold text-red-700" onClick={() => onRemove(index)} type="button">Remove optional loop</button> : null}
        next={() => onSave("dashboard")}
        nextLabel="Save and return"
        secondaryNext={index + 1 < 6 ? () => onSave("next") : undefined}
        secondaryNextLabel={index + 1 < 6 ? `Save and start Loop ${index + 2}` : undefined}
      />
    </Screen>
  );
}

function ReviewScreen({
  completeRequiredLoops,
  contextComplete,
  evidenceReady,
  finalNoIdentifiers,
  loopStatuses,
  operationsComplete,
  submitStatus,
  totalLoops,
  errors,
  onBack,
  onConfirm,
  onSubmit,
}: {
  completeRequiredLoops: number;
  contextComplete: boolean;
  evidenceReady: boolean;
  finalNoIdentifiers: boolean;
  loopStatuses: LoopStatus[];
  operationsComplete: boolean;
  submitStatus: string;
  totalLoops: number;
  errors: FormErrors;
  onBack: () => void;
  onConfirm: (checked: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <Screen title="Review and submit" eyebrow="Final check" description="You can submit after 6 loops. Extra loops are optional. Incomplete optional loops are not submitted.">
      <FieldCard title="Submission summary" description="Fix any incomplete required item before submitting.">
        <SummaryRow label="Respondent context" complete={contextComplete} />
        {loopStatuses.slice(0, 6).map((status, index) => (
          <SummaryRow key={index} label={`Loop ${index + 1}`} complete={status === "Complete"} detail={status} />
        ))}
        <SummaryRow label="Evidence/confidence present for all submitted loops" complete={evidenceReady} />
        <SummaryRow label="Operational readiness questions" complete={operationsComplete} />
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Rows to submit: {totalLoops}. Required loops complete: {completeRequiredLoops}/6.</div>
      </FieldCard>
      <FieldCard title="Final privacy confirmation">
        <Checkbox
          checked={finalNoIdentifiers}
          label="I confirm that I did not enter patient identifiers."
          onChange={onConfirm}
        />
        <ErrorText message={errors.final_no_identifiers || errors.form} />
      </FieldCard>
      {submitStatus ? <Notice>{submitStatus}</Notice> : null}
      <StickyNav
        back={onBack}
        next={onSubmit}
        nextDisabled={completeRequiredLoops < 6 || !finalNoIdentifiers}
        nextLabel="Submit de-identified audit"
      />
    </Screen>
  );
}

function ThankYou({ submissionId }: { submissionId: string }) {
  return (
    <Screen
      title="Submission received"
      eyebrow="Thank you"
      description="Thank you for contributing to the CARE-PROGRESS India research pilot. Your response helps measure how time-sensitive outpatient care loops progress through review, contact, action, and closure."
    >
      <FieldCard title="What happens next" description="No clinical advice or patient-specific recommendation is generated by this website.">
        {submissionId ? <p className="text-xs text-slate-500">Submission ID: {submissionId}</p> : null}
      </FieldCard>
    </Screen>
  );
}

function Screen({
  children,
  description,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="max-w-3xl">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
        {description ? <p className="mt-3 text-base leading-7 text-slate-600">{description}</p> : null}
      </div>
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function FieldCard({ children, description, title }: { children: React.ReactNode; description?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function TimelineExplainer() {
  return (
    <FieldCard title="Use day offsets, not dates" description="The index event is the day the loop began, such as when a result became available or a referral was created.">
      <p className="text-sm leading-6 text-slate-700">
        The index event is Day 0. If clinical review happened the same day, enter 0. If it happened three days later, enter 3.
        If unknown or not needed, use the status field rather than guessing.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard label="Same day" value="0" />
        <MetricCard label="Three days later" value="3" />
        <MetricCard label="One week later" value="7" />
      </div>
    </FieldCard>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function PrivacyReminder({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 ${compact ? "px-3 py-2 text-sm" : "p-4 text-sm leading-6"}`}>
      Do not enter patient identifiers.
      {!compact ? ` ${IDENTIFIER_WARNING}` : " No names, phone numbers, MRNs, Aadhaar numbers, or identifiable details."}
    </p>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">{children}</p>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Definition({ term, text }: { term: string; text: string }) {
  return (
    <p className="text-sm leading-6 text-slate-700">
      <span className="font-semibold text-slate-950">{term}:</span> {text}.
    </p>
  );
}

function SummaryRow({ complete, detail, label }: { complete: boolean; detail?: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
        {detail ?? (complete ? "Complete" : "Needs attention")}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: LoopStatus }) {
  const classes = {
    Complete: "bg-emerald-100 text-emerald-800",
    "In progress": "bg-amber-100 text-amber-900",
    "Not started": "bg-slate-100 text-slate-600",
  }[status];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

function StickyNav({
  back,
  extra,
  next,
  nextDisabled,
  nextLabel = "Continue",
  secondaryNext,
  secondaryNextLabel,
}: {
  back?: () => void;
  extra?: React.ReactNode;
  next?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  secondaryNext?: () => void;
  secondaryNextLabel?: string;
}) {
  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {back ? <button className="h-12 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={back} type="button">Back</button> : null}
        {extra}
        {secondaryNext ? <button className="h-12 rounded-full border border-blue-200 bg-white px-5 text-sm font-semibold text-blue-700 hover:bg-blue-50" onClick={secondaryNext} type="button">{secondaryNextLabel}</button> : null}
        {next ? <button className="h-12 rounded-full bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={nextDisabled} onClick={next} type="button">{nextLabel}</button> : null}
      </div>
    </div>
  );
}

function TextField({ error, label, onChange, value }: { error?: string; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      <FieldLabel label={label} />
      <span className="mt-1 block text-xs font-normal leading-5 text-amber-800">Do not include names, phone numbers, MRNs, Aadhaar numbers, or identifiable details.</span>
      <input className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" value={value} onChange={(event) => onChange(event.target.value)} />
      <ErrorText message={error} />
    </label>
  );
}

function NumberField({ error, label, onChange, value }: { error?: string; label: string; onChange: (value: number | null) => void; value: number | null }) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      <FieldLabel label={label} />
      <input className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" min={0} inputMode="numeric" type="number" value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} />
      <span className="mt-1 block text-xs font-normal text-slate-500">Please enter a whole number of days, such as 0, 3, or 7.</span>
      <ErrorText message={error} />
    </label>
  );
}

function SelectField({
  error,
  helper,
  label,
  onChange,
  options,
  required = true,
  value,
}: {
  error?: string;
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  options: readonly string[];
  required?: boolean;
  value: string | number | null;
}) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      <FieldLabel label={label} required={required} />
      {helper ? <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{helper}</span> : null}
      <select className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option || "No response"}</option>
        ))}
      </select>
      <ErrorText message={error} />
    </label>
  );
}

function FieldLabel({ label, required = true }: { label: string; required?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${required ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
        {required ? "Required" : "Optional"}
      </span>
    </span>
  );
}

function Checkbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
      <input className="mt-1 size-5 rounded border-slate-300 accent-blue-700" checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function CheckboxGroup({ error, label, onChange, options, required = true, values }: { error?: string; label: string; onChange: (values: string[]) => void; options: readonly string[]; required?: boolean; values: readonly string[] }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">
        <FieldLabel label={label} required={required} />
      </legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700" key={option}>
            <input
              checked={values.includes(option)}
              className="size-5 rounded border-slate-300 accent-blue-700"
              type="checkbox"
              onChange={(event) => {
                const next = event.target.checked ? [...values, option] : values.filter((value) => value !== option);
                onChange(next);
              }}
            />
            {option}
          </label>
        ))}
      </div>
      <ErrorText message={error} />
    </fieldset>
  );
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-sm font-medium text-red-700">{message}</p> : null;
}
