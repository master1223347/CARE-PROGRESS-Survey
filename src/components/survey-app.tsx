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
import { getLoopQualityAssessment } from "@/lib/derived";
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
type LoopStatus = "Not started" | "Saved, incomplete" | "Usable for analysis";

const draftKey = "care-progress-survey-draft-v2";
const steps: Array<{ key: Step; label: string }> = [
  { key: "intro", label: "Welcome" },
  { key: "consent", label: "Privacy" },
  { key: "how", label: "Examples" },
  { key: "context", label: "About You" },
  { key: "loopIntro", label: "Before You Start" },
  { key: "loops", label: "6 Examples" },
  { key: "operations", label: "Clinic Setup" },
  { key: "review", label: "Final Check" },
];

const careLoopExamples = [
  "abnormal HbA1c result",
  "abnormal creatinine/eGFR result",
  "abnormal imaging result",
  "pathology follow-up",
  "specialist referral",
  "imaging referral",
  "post-procedure follow-up",
  "repeat test order",
];

const friendlyOptionLabels: Record<string, string> = {
  "": "No response",
  Admin: "Administrator",
  "Medical assistant": "Medical assistant (MA)",
  "Clinic coordinator": "Clinic coordinator",
  "Lab staff": "Lab staff",
  "OB-GYN": "Obstetrics/gynecology (OB-GYN)",
  "Private hospital OPD": "Private hospital outpatient department (OPD)",
  "Government hospital OPD": "Government hospital outpatient department (OPD)",
  MA: "Medical assistant (MA)",
  Coordinator: "Coordinator / care coordinator",
  "Lab coordinator": "Lab coordinator",
  "Clinic software": "Clinic software",
  EHR: "Electronic health record (EHR)",
  "EHR task": "EHR task or reminder",
  "WhatsApp/photos": "WhatsApp or photos",
  "Paper log": "Paper log or register",
  "Physician memory": "Doctor remembers without a formal tracking system",
  "Staff memory": "Staff remember without a formal tracking system",
  Mixed: "More than one method",
  "Portal/app": "Patient portal or app",
  "1 mostly paper": "1: Mostly paper",
  "2 paper + phone": "2: Paper plus phone",
  "3 spreadsheet or WhatsApp tracking": "3: Spreadsheet or WhatsApp tracking",
  "4 clinic software": "4: Clinic software",
  "5 integrated EHR or task system": "5: Integrated EHR or task system",
  "Abnormal diagnostic result": "Abnormal test or result",
  "Referral or follow-up": "Referral or follow-up task",
  CBC: "Complete blood count (CBC)",
  HbA1c: "HbA1c / average blood sugar test",
  "renal function": "Kidney function test",
  "liver function": "Liver function test",
  thyroid: "Thyroid test",
  lipid: "Lipid / cholesterol test",
  ultrasound: "Ultrasound",
  "CT/MRI": "CT or MRI scan",
  pathology: "Pathology result",
  other: "Other",
  oncology: "Oncology",
  endocrinology: "Endocrinology",
  imaging: "Imaging",
  surgery: "Surgery",
  pediatrics: "Pediatrics",
  "post-procedure": "Post-procedure",
  "chronic follow-up": "Chronic follow-up",
  Routine: "Routine",
  "Semi-urgent": "Semi-urgent",
  Urgent: "Urgent",
  Critical: "Critical",
  Mild: "Mild",
  Moderate: "Moderate",
  Severe: "Severe",
  "Not applicable": "Not applicable",
  Unclear: "Unclear / cannot judge",
  Unknown: "Unknown / not sure",
  "Same day": "Same day (Day 0)",
  Reviewed: "Reviewed",
  "Not reviewed": "Not reviewed",
  "Not needed": "Not needed for this case",
  Contacted: "Contacted",
  "Not contacted": "Not contacted",
  "Action documented": "Action taken and recorded",
  "No action needed": "No action needed",
  "Action not documented": "No action recorded",
  Scheduled: "Scheduled",
  "Not scheduled": "Not scheduled",
  Closed: "Closed",
  "Still open": "Still open",
  "Lost to follow-up": "Lost to follow-up",
  Escalated: "Escalated",
  "Closed as no action needed": "Closed because no action was needed",
  "System alert": "Software or system alert",
  Specialist: "Specialist",
  "Patient not contacted": "Patient was not contacted",
  Patient: "Patient",
  "No clear owner": "No one clearly responsible",
  System: "Software or system",
  "No formal tracking": "No formal tracking system",
  Resolved: "Resolved",
  "Paper chart": "Paper chart",
  "Lab log": "Lab log",
  "Referral register": "Referral register",
  "Appointment register": "Appointment register",
  "Staff call log": "Staff call log",
  Low: "Low confidence",
  Medium: "Medium confidence",
  High: "High confidence",
  "Most recent consecutive loops": "Most recent eligible examples in order",
  "Randomly selected loops": "Randomly selected examples",
  "Convenience sample": "Chosen because they were easy to find",
  "High-risk examples only": "High-risk examples only",
  Sometimes: "Sometimes / depends on the case",
  Daily: "Daily",
  Weekly: "Weekly",
  Occasionally: "Occasionally",
  none: "None",
  unknown: "Unknown / not sure",
  labs: "Lab results",
  referrals: "Referral records",
  "follow-ups": "Follow-up records",
  "contact logs": "Contact logs",
  Doctor: "Doctor",
  "clinic owner": "Clinic owner",
  "hospital admin": "Hospital administrator",
  "ethics committee": "Ethics or IRB committee",
  "IT department": "IT team",
};

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
  if (message.includes("Invalid input")) return "Please choose one of the listed answers.";
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
  const loopQuality = useMemo(
    () => loops.map((loop) => getLoopQualityAssessment({ ...loop, record_use_basis: consent.record_use_basis })),
    [consent.record_use_basis, loops],
  );
  const loopStatuses = useMemo(
    () =>
      loops.map((_, index): LoopStatus => {
        if (savedLoops.includes(index) && loopValidity[index] && loopQuality[index]?.counts_toward_required_loop) {
          return "Usable for analysis";
        }
        if (savedLoops.includes(index) || editingLoop === index) return "Saved, incomplete";
        return "Not started";
      }),
    [editingLoop, loopQuality, loopValidity, loops, savedLoops],
  );
  const completeRequiredLoops = loopStatuses.slice(0, 6).filter((status) => status === "Usable for analysis").length;
  const submissionLoops = loops.filter((_, index) => index < 6 || loopStatuses[index] === "Usable for analysis");
  const allFamilies = new Set(loops.slice(0, 6).map((loop) => loop.loop_family));
  const nextRequiredLoop = Math.max(0, loopStatuses.slice(0, 6).findIndex((status) => status !== "Usable for analysis"));
  const nextLoopIndex = nextRequiredLoop === -1 ? 0 : nextRequiredLoop;
  const evidenceReady = submissionLoops.every(hasRequiredEvidence);
  const evidenceSourceReady = submissionLoops.every((loop) => Boolean(loop.evidence_source));
  const confidenceReady = submissionLoops.every((loop) => Boolean(loop.confidence));

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
      setSubmitStatus("You can submit after 6 care examples are usable for analysis. Extra examples are optional.");
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
    setSubmitStatus("Submitting de-identified research audit...");
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
          <Screen title="Consent and de-identification" eyebrow="Step 1" description="This de-identified research audit uses example codes and role categories only. Do not enter patient-identifying information or clinical documents.">
            <PrivacyReminder />
            <FieldCard title="Please confirm these points" description="Both boxes must be checked before you continue.">
              <Checkbox
                checked={Boolean(consent.confirm_no_identifiers)}
                label="I confirm that I will not enter patient names, phone numbers, addresses, Aadhaar numbers, medical record numbers, prescription images, lab-report photos, WhatsApp screenshots, raw clinical notes, or other identifiable information."
                onChange={(checked) => setConsent({ ...consent, confirm_no_identifiers: checked as true })}
              />
              <Checkbox
                checked={Boolean(consent.confirm_research_only)}
                label="I understand this is a de-identified research audit of outpatient care-loop progression. It is not a performance evaluation and it does not give clinical advice."
                onChange={(checked) => setConsent({ ...consent, confirm_research_only: checked as true })}
              />
              <SelectField
                error={errors.record_use_basis}
                helper="Records are best. If you need to rely partly on memory, that is okay. You will record your confidence later."
                label="Will you use clinic records wherever possible?"
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
          <Screen title="About you and your clinic" eyebrow="Step 3" description="This short section helps interpret timing by role, clinic setup, tracking method, and how paper- or software-based the workflow is.">
            <PrivacyReminder compact />
            <FieldCard title="About the respondent and clinic" description="Choose the closest category. Use job roles only, not staff names.">
              <FieldGrid>
                <SelectField label="Your role" options={respondentRoles} value={context.respondent_role} onChange={(value) => setContext({ ...context, respondent_role: value as RespondentContext["respondent_role"] })} error={errors.respondent_role} />
                <SelectField label="Specialty or service area" options={specialties} value={context.specialty} onChange={(value) => setContext({ ...context, specialty: value as RespondentContext["specialty"] })} error={errors.specialty} />
                <SelectField label="Type of clinic or outpatient setting" options={practiceSettings} value={context.practice_setting} onChange={(value) => setContext({ ...context, practice_setting: value as RespondentContext["practice_setting"] })} error={errors.practice_setting} />
                <SelectField label="About how many outpatients are seen per day?" options={opdVolumes} value={context.opd_volume} onChange={(value) => setContext({ ...context, opd_volume: value as RespondentContext["opd_volume"] })} error={errors.opd_volume} />
              </FieldGrid>
            </FieldCard>
            <FieldCard title="Tracking and communication" description="Answer about the clinic's usual setup overall, not one patient.">
              <FieldGrid>
                <SelectField helper="EHR means electronic health record." label="Main record system" options={["Paper", "EHR", "Clinic software", "WhatsApp/photos", "Mixed", "Other"]} value={context.record_system} onChange={(value) => setContext({ ...context, record_system: value as RespondentContext["record_system"] })} error={errors.record_system} />
                <SelectField label="How are lab results usually tracked?" options={trackingOptions} value={context.lab_tracking} onChange={(value) => setContext({ ...context, lab_tracking: value as RespondentContext["lab_tracking"] })} error={errors.lab_tracking} />
                <SelectField label="How are referrals usually tracked?" options={trackingOptions} value={context.referral_tracking} onChange={(value) => setContext({ ...context, referral_tracking: value as RespondentContext["referral_tracking"] })} error={errors.referral_tracking} />
                <SelectField label="How are follow-up tasks usually tracked?" options={trackingOptions} value={context.followup_tracking} onChange={(value) => setContext({ ...context, followup_tracking: value as RespondentContext["followup_tracking"] })} error={errors.followup_tracking} />
                <SelectField label="Main way patients are usually contacted" options={communicationChannels} value={context.communication_channel} onChange={(value) => setContext({ ...context, communication_channel: value as RespondentContext["communication_channel"] })} error={errors.communication_channel} />
                <SelectField helper="Pick the option that best matches the clinic's usual follow-up setup." label="How digital is the clinic's follow-up system?" options={digitalMaturityOptions} value={digitalMaturityOptions[context.digital_maturity - 1]} onChange={(value) => setContext({ ...context, digital_maturity: Number(value.charAt(0)) })} error={errors.digital_maturity} />
              </FieldGrid>
              <CheckboxGroup
                label="Support staff usually available for follow-up work"
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
            recordUseBasis={consent.record_use_basis}
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
          <Screen title="Clinic follow-up setup" eyebrow="Step 8" description="These questions are about how the clinic handles follow-up overall and whether data with identifying details removed might be shared later.">
            <PrivacyReminder compact />
            <FieldCard title="Clinic-level setup" description="Use roles or departments only. Do not enter staff names.">
              <FieldGrid>
                <SelectField label="Is there usually a clearly named person responsible for following up abnormal results?" options={ownerExistsOptions} value={operations.abnormal_result_owner_exists} onChange={(value) => setOperations({ ...operations, abnormal_result_owner_exists: value as SiteOperations["abnormal_result_owner_exists"] })} error={errors.abnormal_result_owner_exists} />
                <SelectField label="Is there usually a clearly named person responsible for making sure referrals are completed?" options={ownerExistsOptions} value={operations.referral_owner_exists} onChange={(value) => setOperations({ ...operations, referral_owner_exists: value as SiteOperations["referral_owner_exists"] })} error={errors.referral_owner_exists} />
                <SelectField label="Are still-open items usually reviewed daily or weekly?" options={unresolvedReviewCadenceOptions} value={operations.unresolved_review_cadence} onChange={(value) => setOperations({ ...operations, unresolved_review_cadence: value as SiteOperations["unresolved_review_cadence"] })} error={errors.unresolved_review_cadence} />
                <SelectField label="Could the clinic share logs with identifying details removed in the future?" options={futureExportAvailableOptions} value={operations.future_export_available} onChange={(value) => setOperations({ ...operations, future_export_available: value as SiteOperations["future_export_available"] })} error={errors.future_export_available} />
                <SelectField label="What group would need to approve future data sharing?" options={futureApprovalPathOptions} value={operations.future_approval_path} onChange={(value) => setOperations({ ...operations, future_approval_path: value as SiteOperations["future_approval_path"] })} error={errors.future_approval_path} />
              </FieldGrid>
            </FieldCard>
            <StickyNav back={() => goTo("loops")} next={advanceFromOperations} nextLabel="Review answers" />
          </Screen>
        ) : null}

        {step === "review" ? (
          <ReviewScreen
            completeRequiredLoops={completeRequiredLoops}
            contextComplete={!Object.keys(validate(contextSchema, context)).length}
            confidenceReady={confidenceReady}
            evidenceReady={evidenceReady}
            evidenceSourceReady={evidenceSourceReady}
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
            Outpatient care-loop progression audit
          </h1>
          <p className="mt-2 text-sm text-slate-600">Current step: {label}. Required care examples usable for analysis: {completeLoops}/6.</p>
        </div>
        <a className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-blue-700 hover:border-blue-200 hover:bg-blue-50" href="/admin">
          Data export
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
      title="CARE-PROGRESS India"
      eyebrow="De-identified research audit"
      description="This survey collects specific recent outpatient care examples to study workflow progression under clinical time-sensitivity."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Estimated time" value="13-19 minutes" />
        <MetricCard label="Required work" value="6 care examples" />
        <MetricCard label="Privacy" value="No patient identifiers" />
      </div>
      <FieldCard title="Purpose of this research">
        <p className="text-sm leading-6 text-slate-700">
          This study examines how time-sensitive outpatient care tasks move through real clinic workflows. We are
          interested in when abnormal results, referrals, and follow-up tasks are reviewed, acted on, escalated,
          closed, or lost to follow-up.
        </p>
        <p className="text-sm leading-6 text-slate-700">
          The goal is to understand workflow progression and delays, not to evaluate individual doctors or clinics.
        </p>
      </FieldCard>
      <FieldCard title="Do not enter patient identifiers">
        <p className="text-sm leading-6 text-slate-700">
          Please do not enter names, phone numbers, addresses, Aadhaar numbers, MRNs, screenshots, prescriptions,
          lab reports, WhatsApp messages, or any identifiable clinical documents. Use made-up example codes such as
          L001, L002, and L003.
        </p>
        <PrivacyReminder compact />
      </FieldCard>
      <FieldCard title="What you will do" description="Use records where possible. Each row should describe one specific recent care example, not what usually happens.">
        <p className="text-sm leading-6 text-slate-700">
          You will first confirm the privacy rules, then complete respondent and clinic context, followed by 6
          specific recent care examples. Extra examples are optional.
        </p>
      </FieldCard>
      <StickyNav next={onStart} nextLabel="Begin audit" />
    </Screen>
  );
}

function HowThisWorks({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <Screen
      title="Before the respondent and clinic questions"
      eyebrow="Study overview"
      description="Please review what counts as a care example and how the examples should be selected before continuing."
    >
      <FieldCard title="What counts as a care example?">
        <p className="text-sm leading-6 text-slate-700">
          A care example is one specific recent clinical task that began at a clear point and should later be
          reviewed, acted on, closed, escalated, or marked as no action needed.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {careLoopExamples.map((example) => (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" key={example}>
              {example}
            </div>
          ))}
        </div>
      </FieldCard>
      <FieldCard title="How to choose examples">
        <p className="text-sm leading-6 text-slate-700">
          Please use recent examples from the last 30-90 days. When possible, choose the most recent eligible
          examples in order rather than only memorable, severe, successful, or failed cases. This makes the dataset
          more interpretable.
        </p>
      </FieldCard>
      <StickyNav back={onBack} next={onNext} nextLabel="Continue" />
    </Screen>
  );
}

function CareLoopIntro({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <Screen
      title="Before Example 1"
      eyebrow="Care-example entry"
      description="You will now enter one specific recent care example at a time. Use records where possible. Each example should take about 2 minutes."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FieldCard title="Recommended mix" description="Preferred, but not required.">
          <p className="text-sm leading-6 text-slate-700">Ideally: 3 abnormal diagnostic result examples and 3 referral or follow-up examples.</p>
        </FieldCard>
        <FieldCard title="Helpful definitions" description="These study terms appear in the form.">
          <Definition term="Index event" text="the starting point for this example, such as when a result became available or a referral was created" />
          <Definition term="Closure" text="the point where the example was resolved, escalated, completed, or clearly marked as no action needed" />
          <Definition term="Handoff" text="the example moved from one person or role to another" />
          <Definition term="Evidence source" text="what you used to answer the row, such as the chart, lab log, referral register, or memory" />
        </FieldCard>
      </div>
      <StickyNav back={onBack} next={onNext} nextLabel="Open care-example dashboard" />
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
      title="Care-example dashboard"
      eyebrow="6 required examples"
      description="Complete one care example at a time. You can submit after 6 examples are usable for analysis. Extra examples are optional."
    >
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-950">Ideally: 3 abnormal diagnostic result examples and 3 referral or follow-up examples</p>
            <p className="mt-1 text-sm text-blue-900">Use the most recent eligible examples in order from the last 30-90 days. Specific recent examples are required, not the clinic&apos;s usual process.</p>
          </div>
          <button className="h-12 rounded-full bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800" onClick={() => onOpenLoop(nextLoopIndex)} type="button">
            {completeRequiredLoops === 0 ? "Start Example 1" : completeRequiredLoops < 6 ? `Continue Example ${nextLoopIndex + 1}` : "Review examples"}
          </button>
        </div>
      </div>
      {allFamilies.size === 1 ? <Notice>Reminder: include both main care-loop families when possible. This is preferred, not required.</Notice> : null}
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
                <p className="text-sm font-semibold text-slate-950">Example {index + 1}</p>
                <p className="mt-1 text-xs text-slate-500">{index < 6 ? "Required" : "Optional"}</p>
              </div>
              <StatusBadge status={loopStatuses[index]} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-800">{getOptionLabel(loop.loop_family)}</p>
            <p className="mt-1 text-sm text-slate-500">{getOptionLabel(loop.loop_type)}</p>
            <p className="mt-4 text-xs font-semibold text-blue-700">
              {loopStatuses[index] === "Not started" ? `Start Example ${index + 1}` : `Edit Example ${index + 1}`}
            </p>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="h-12 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={completeRequiredLoops < 6 || loops.length >= 10} onClick={onAddLoop} type="button">
          Add optional example
        </button>
        <button className="h-12 rounded-full bg-blue-700 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={completeRequiredLoops < 6} onClick={onContinue} type="button">
          Continue after 6 usable examples ({completeRequiredLoops}/6)
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
  recordUseBasis,
  status,
  onBack,
  onChange,
  onRemove,
  onSave,
}: {
  errors: FormErrors;
  index: number;
  loop: LoopDraft;
  recordUseBasis: Consent["record_use_basis"];
  status: LoopStatus;
  onBack: () => void;
  onChange: (loop: LoopDraft) => void;
  onRemove: (index: number) => void;
  onSave: (mode: "dashboard" | "next") => void;
}) {
  const riskMessage = identifierRiskMessage(loop.loop_code);
  const schemaReady = careLoopSchema.safeParse(loop).success;
  const loopQuality = getLoopQualityAssessment({ ...loop, record_use_basis: recordUseBasis });

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
      title={`Example ${index + 1}: one recent care example`}
      eyebrow={index < 6 ? "Required example" : "Optional example"}
      description="Use records where possible. This should describe one specific recent care example, not the clinic's usual process."
    >
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">Current status</p>
          <p className="text-sm text-slate-500">A saved example counts toward the required six only when it is usable for analysis.</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <PrivacyReminder compact />

      <FieldCard title="A. Basic details" description="Describe the example without using any patient-identifying detail.">
        <FieldGrid>
          <TextField label="Example code" value={loop.loop_code} onChange={(value) => update("loop_code", value)} error={errors.loop_code || riskMessage} />
          <SelectField helper="Choose the broad type of example first." label="Type of example" options={loopFamilies} value={loop.loop_family} onChange={(value) => update("loop_family", value as LoopDraft["loop_family"])} error={errors.loop_family} />
          <SelectField helper="Pick the closest match." label="Specific example type" options={loopTypes} value={loop.loop_type} onChange={(value) => update("loop_type", value as LoopDraft["loop_type"])} error={errors.loop_type} />
          <SelectField label="Which specialty or service area was involved?" options={loopSpecialties} value={loop.loop_specialty} onChange={(value) => update("loop_specialty", value as LoopDraft["loop_specialty"])} error={errors.loop_specialty} />
          {loop.loop_family === "Abnormal diagnostic result" ? <SelectField label="What kind of test or result was it?" options={testCategories} value={loop.test_category || "N/A"} onChange={(value) => update("test_category", value as LoopDraft["test_category"])} error={errors.test_category} /> : null}
          {loop.loop_family === "Referral or follow-up" ? <SelectField label="What kind of referral or follow-up was it?" options={referralCategories} value={loop.referral_category || "N/A"} onChange={(value) => update("referral_category", value as LoopDraft["referral_category"])} error={errors.referral_category} /> : null}
        </FieldGrid>
      </FieldCard>

      <FieldCard title="B. Clinical time-sensitivity" description="These fields help interpret whether delay was clinically meaningful.">
        <FieldGrid>
          <SelectField helper="How time-sensitive was this example clinically?" label="Clinical urgency" options={urgencyOptions} value={loop.urgency} onChange={(value) => update("urgency", value as LoopDraft["urgency"])} error={errors.urgency} />
          <SelectField helper="How serious was the underlying issue, based on what was known then?" label="How serious was it?" options={severityOptions} value={loop.severity} onChange={(value) => update("severity", value as LoopDraft["severity"])} error={errors.severity} />
          <SelectField helper="How soon should this ideally have reached closure?" label="Recommended closure window" options={recommendedWindows} value={loop.recommended_window} onChange={(value) => update("recommended_window", value as LoopDraft["recommended_window"])} error={errors.recommended_window} />
          <SelectField helper="Based on what you know, could waiting have mattered for patient care?" label="Could waiting have affected care?" options={yesNoUnclear} value={loop.delay_affect_care} onChange={(value) => update("delay_affect_care", value as LoopDraft["delay_affect_care"])} error={errors.delay_affect_care} />
        </FieldGrid>
      </FieldCard>

      <TimelineExplainer />
      <FieldCard title="C. Timing" description="Use day counts from the start of the example, not calendar dates.">
        <FieldGrid>
          <SelectField helper="Was it reviewed by a clinician?" label="Clinician review status" options={reviewStatuses} value={loop.review_status} onChange={(value) => update("review_status", value as LoopDraft["review_status"])} error={errors.review_status} />
          {loop.review_status === "Reviewed" ? <NumberField label="Days from Day 0 to clinician review" value={loop.review_day_offset} onChange={(value) => update("review_day_offset", value)} error={errors.review_day_offset} /> : null}
          <SelectField helper="Was the patient contacted?" label="Patient contact status" options={contactStatuses} value={loop.contact_status} onChange={(value) => update("contact_status", value as LoopDraft["contact_status"])} error={errors.contact_status} />
          {loop.contact_status === "Contacted" ? <NumberField label="Days from Day 0 to patient contact" value={loop.contact_day_offset} onChange={(value) => update("contact_day_offset", value)} error={errors.contact_day_offset} /> : null}
          <SelectField helper="Was any action recorded in the chart or log?" label="Documented action status" options={actionStatuses} value={loop.action_status} onChange={(value) => update("action_status", value as LoopDraft["action_status"])} error={errors.action_status} />
          {loop.action_status === "Action documented" ? <NumberField label="Days from Day 0 to recorded action" value={loop.action_day_offset} onChange={(value) => update("action_day_offset", value)} error={errors.action_day_offset} /> : null}
          <SelectField helper="Was a visit, test, or referral appointment scheduled?" label="Follow-up scheduled status" options={followupScheduledStatuses} value={loop.followup_scheduled_status} onChange={(value) => update("followup_scheduled_status", value as LoopDraft["followup_scheduled_status"])} error={errors.followup_scheduled_status} />
          {loop.followup_scheduled_status === "Scheduled" ? <NumberField label="Days from Day 0 to scheduling" value={loop.followup_scheduled_day_offset} onChange={(value) => update("followup_scheduled_day_offset", value)} error={errors.followup_scheduled_day_offset} /> : null}
          <SelectField helper="Choose the best description of where this example ended up." label="Final or current state" options={closureStatuses} value={loop.closure_status} onChange={(value) => update("closure_status", value as LoopDraft["closure_status"])} error={errors.closure_status} />
          {closureOffsetStatuses.includes(loop.closure_status) ? <NumberField label="Days from Day 0 to final status" value={loop.closure_day_offset} onChange={(value) => update("closure_day_offset", value)} error={errors.closure_day_offset} /> : null}
          {loop.closure_status === "Still open" ? <NumberField label="If still open, how many days old was it?" value={loop.audit_age_days_if_open} onChange={(value) => update("audit_age_days_if_open", value)} error={errors.audit_age_days_if_open} /> : null}
        </FieldGrid>
      </FieldCard>

      <FieldCard title="D. Who handled it" description="Roles are enough. Do not enter staff names. A handoff means the work moved from one person or role to another.">
        <FieldGrid>
          <SelectField label="Who first received or noticed it?" options={firstReceiverRoles} value={loop.first_receiver_role} onChange={(value) => update("first_receiver_role", value as LoopDraft["first_receiver_role"])} error={errors.first_receiver_role} />
          <SelectField label="Who reviewed it clinically?" options={reviewerRoles} value={loop.reviewer_role} onChange={(value) => update("reviewer_role", value as LoopDraft["reviewer_role"])} error={errors.reviewer_role} />
          <SelectField label="Who contacted the patient?" options={contactRoles} value={loop.contact_role} onChange={(value) => update("contact_role", value as LoopDraft["contact_role"])} error={errors.contact_role} />
          <SelectField helper="Who was mainly responsible for making sure it got finished?" label="Who was mainly responsible?" options={ownerRoles} value={loop.owner_role} onChange={(value) => update("owner_role", value as LoopDraft["owner_role"])} error={errors.owner_role} />
          <SelectField label="Who finished or closed it?" options={closerRoles} value={loop.closer_role} onChange={(value) => update("closer_role", value as LoopDraft["closer_role"])} error={errors.closer_role} />
          <SelectField helper="A handoff means the work moved from one person or role to another." label="How many times did it move between people or roles?" options={handoffCounts} value={loop.handoff_count} onChange={(value) => update("handoff_count", value as LoopDraft["handoff_count"])} error={errors.handoff_count} />
          <SelectField helper="How was this example kept track of in practice?" label="Tracking method for this example" options={loopTrackingOptions} value={loop.tracking_method} onChange={(value) => update("tracking_method", value as LoopDraft["tracking_method"])} error={errors.tracking_method} />
          <SelectField label="Were support staff involved?" options={yesNoUnclear} value={loop.support_staff_involved} onChange={(value) => update("support_staff_involved", value as LoopDraft["support_staff_involved"])} error={errors.support_staff_involved} />
          <SelectField label="Main way the patient was contacted" options={loopCommunicationChannels} value={loop.loop_communication_channel} onChange={(value) => update("loop_communication_channel", value as LoopDraft["loop_communication_channel"])} error={errors.loop_communication_channel} />
          <SelectField required={false} label="About how many outpatients were seen that day?" options={opdVolumes} value={loop.clinic_load || "Unknown"} onChange={(value) => update("clinic_load", value as LoopDraft["clinic_load"])} error={errors.clinic_load} />
        </FieldGrid>
      </FieldCard>

      <FieldCard title="E. Outcome" description="Use documented status where available. These fields describe what happened and are not used for performance evaluation.">
        <FieldGrid>
          <SelectField helper="Best overall status at the time of this survey." label="Best overall status now" options={currentStatuses} value={loop.current_status} onChange={(value) => update("current_status", value as LoopDraft["current_status"])} error={errors.current_status} />
          <SelectField label="Was the patient successfully reached?" options={yesNoNotNeededUnknown} value={loop.patient_contacted} onChange={(value) => update("patient_contacted", value as LoopDraft["patient_contacted"])} error={errors.patient_contacted} />
          <SelectField label="Was follow-up completed?" options={yesNoNotNeededUnknown} value={loop.followup_completed} onChange={(value) => update("followup_completed", value as LoopDraft["followup_completed"])} error={errors.followup_completed} />
          <SelectField label="Was urgent escalation needed?" options={yesNoUnclear} value={loop.escalation_required} onChange={(value) => update("escalation_required", value as LoopDraft["escalation_required"])} error={errors.escalation_required} />
          <SelectField label="Was emergency referral or hospital admission recorded?" options={yesNoUnclear} value={loop.emergency_referral_or_admission} onChange={(value) => update("emergency_referral_or_admission", value as LoopDraft["emergency_referral_or_admission"])} error={errors.emergency_referral_or_admission} />
          <SelectField label="Did this example lead to a change in the care plan?" options={yesNoUnclear} value={loop.care_plan_changed} onChange={(value) => update("care_plan_changed", value as LoopDraft["care_plan_changed"])} error={errors.care_plan_changed} />
        </FieldGrid>
      </FieldCard>

      <FieldCard title="F. Evidence source and confidence" description="Record-backed answers are best, but memory-based answers are allowed if marked honestly. Evidence source and confidence help separate stronger rows from weaker rows during analysis.">
        <FieldGrid>
          <SelectField helper="This shows whether the answers came from records or memory." label="What source did you use for these answers?" options={evidenceSources} value={loop.evidence_source} onChange={(value) => update("evidence_source", value as LoopDraft["evidence_source"])} error={errors.evidence_source} />
          <SelectField label="How confident are you in these answers?" options={confidenceOptions} value={loop.confidence} onChange={(value) => update("confidence", value as LoopDraft["confidence"])} error={errors.confidence} />
          <SelectField helper="This shows whether the example was chosen systematically or just because it was easy to find." label="How was this example selected?" options={selectionMethods} value={loop.selection_method} onChange={(value) => update("selection_method", value as LoopDraft["selection_method"])} error={errors.selection_method} />
          <SelectField required={false} label="Could a version with identifying details removed be checked later by a reviewer?" options={["", "Yes", "No", "Maybe"]} value={loop.verification_willingness || ""} onChange={(value) => update("verification_willingness", value as LoopDraft["verification_willingness"])} error={errors.verification_willingness} />
        </FieldGrid>
      </FieldCard>

      <FieldCard title="Loop quality check" description="This check affects whether the example counts toward the required six examples.">
        {schemaReady && loopQuality.counts_toward_required_loop ? (
          <Notice>This example is usable for analysis and will count toward the required examples.</Notice>
        ) : (
          <>
            <Notice>This example has been saved, but too many key fields are unknown for it to count toward the required six examples. If possible, choose another recent example with more record-backed information.</Notice>
            {loopQuality.missing_requirements.length ? (
              <p className="text-sm leading-6 text-slate-700">
                Key items still needed: {loopQuality.missing_requirements.join(", ")}.
              </p>
            ) : null}
          </>
        )}
      </FieldCard>

      <StickyNav
        back={onBack}
        extra={index >= 6 ? <button className="h-12 rounded-full border border-red-200 bg-white px-5 text-sm font-semibold text-red-700" onClick={() => onRemove(index)} type="button">Remove optional example</button> : null}
        next={() => onSave("dashboard")}
        nextLabel="Save example"
        secondaryNext={index + 1 < 6 ? () => onSave("next") : undefined}
        secondaryNextLabel={index + 1 < 6 ? `Save and start Example ${index + 2}` : undefined}
      />
    </Screen>
  );
}

function ReviewScreen({
  completeRequiredLoops,
  confidenceReady,
  contextComplete,
  evidenceReady,
  evidenceSourceReady,
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
  confidenceReady: boolean;
  contextComplete: boolean;
  evidenceReady: boolean;
  evidenceSourceReady: boolean;
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
    <Screen title="Review and submit" eyebrow="Final verification" description="You can submit after 6 care examples are usable for analysis. Extra examples are optional. Unfinished optional examples will not be submitted.">
      <FieldCard title="Submission summary" description="Fix any incomplete required item before final submission.">
        <SummaryRow label="About you and your clinic" complete={contextComplete} />
        <SummaryRow
          label="6 required care examples complete"
          complete={completeRequiredLoops === 6}
          detail={`${completeRequiredLoops}/6 usable for analysis`}
        />
        {loopStatuses.slice(0, 6).map((status, index) => (
          <SummaryRow key={index} label={`Care example ${index + 1}`} complete={status === "Usable for analysis"} detail={status} />
        ))}
        <SummaryRow label="Evidence source present for all required examples" complete={evidenceSourceReady} />
        <SummaryRow label="Confidence present for all required examples" complete={confidenceReady} />
        <SummaryRow label="Clinic setup questions" complete={operationsComplete} />
        <SummaryRow label="Patient identifiers not entered confirmation" complete={finalNoIdentifiers} detail={finalNoIdentifiers ? "Confirmed" : "Pending"} />
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Rows to submit: {totalLoops}. Required care examples usable for analysis: {completeRequiredLoops}/6.</div>
      </FieldCard>
      {!evidenceReady ? (
        <Notice>
          One or more submitted examples still need evidence source, confidence, or selection method details to be fully interpretable.
        </Notice>
      ) : null}
      <FieldCard title="Final privacy confirmation">
        <Checkbox
          checked={finalNoIdentifiers}
          label="I confirm that I did not enter any patient-identifying information."
          onChange={onConfirm}
        />
        <ErrorText message={errors.final_no_identifiers || errors.form} />
      </FieldCard>
      {submitStatus ? <Notice>{submitStatus}</Notice> : null}
      <StickyNav
        back={onBack}
        next={onSubmit}
        nextDisabled={completeRequiredLoops < 6 || !finalNoIdentifiers}
        nextLabel="Submit de-identified research audit"
      />
    </Screen>
  );
}

function ThankYou({ submissionId }: { submissionId: string }) {
  return (
    <Screen
      title="Submission received"
      eyebrow="Thank you"
      description="Thank you for contributing to the CARE-PROGRESS India research pilot. Your response helps study how time-sensitive outpatient care tasks progress through review, patient contact, action, escalation, and closure."
    >
      <FieldCard title="What happens next" description="This survey is for research and dataset development only. It is not a clinical decision-making tool and is not used to evaluate individual doctors or clinics.">
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
    <FieldCard title="Use day counts, not calendar dates" description="The index event is the starting day for this example, such as when a result became available or a referral was created.">
      <p className="text-sm leading-6 text-slate-700">
        The starting point is Day 0. If a result became available and was reviewed the same day, review day = 0.
        If it was reviewed three days later, review day = 3. If you do not know, choose Unknown rather than guessing.
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
      Do not enter patient-identifying information.
      {!compact ? ` ${IDENTIFIER_WARNING}` : " No names, phone numbers, MRNs, Aadhaar numbers, screenshots, or document images."}
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
    "Usable for analysis": "bg-emerald-100 text-emerald-800",
    "Saved, incomplete": "bg-amber-100 text-amber-900",
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
      <span className="mt-1 block text-xs font-normal leading-5 text-amber-800">Use a made-up code only. Do not include names, phone numbers, MRNs, Aadhaar numbers, or other identifying details.</span>
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
          <option key={option} value={option}>{getOptionLabel(option)}</option>
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
            {getOptionLabel(option)}
          </label>
        ))}
      </div>
      <ErrorText message={error} />
    </fieldset>
  );
}

function getOptionLabel(option: string) {
  return friendlyOptionLabels[option] ?? option;
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-sm font-medium text-red-700">{message}</p> : null;
}
