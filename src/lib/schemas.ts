import { z } from "zod";
import {
  actionStatuses,
  closureStatuses,
  closerRoles,
  communicationChannels,
  confidenceOptions,
  contactRoles,
  contactStatuses,
  currentStatuses,
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
import { hasIdentifierRisk } from "@/lib/privacy";

const enumOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);

const optionalInt = z.preprocess(
  (value) => {
    if (value === "" || value == null) return null;
    if (typeof value === "string") return Number(value);
    return value;
  },
  z.number().int().min(0).nullable(),
);

export type RowLike = Record<string, unknown>;

export const consentSchema = z.object({
  confirm_no_identifiers: z.literal(true),
  confirm_research_only: z.literal(true),
  record_use_basis: enumOf(recordUseBasisOptions),
});

export const contextSchema = z.object({
  respondent_role: enumOf(respondentRoles),
  specialty: enumOf(specialties),
  practice_setting: enumOf(practiceSettings),
  opd_volume: enumOf(opdVolumes),
  support_staff: z.array(enumOf(supportStaffOptions)).min(1),
  record_system: z.enum(["Paper", "EHR", "Clinic software", "WhatsApp/photos", "Mixed", "Other"]),
  lab_tracking: enumOf(trackingOptions),
  referral_tracking: enumOf(trackingOptions),
  followup_tracking: enumOf(trackingOptions),
  communication_channel: enumOf(communicationChannels),
  digital_maturity: z.preprocess(
    (value) => {
      if (typeof value === "string") return Number(value.charAt(0));
      return value;
    },
    z.number().int().min(1).max(5),
  ),
});

export const careLoopSchema = z
  .object({
    loop_code: z.string().trim().min(1).max(20).regex(/^L\d{3}$/i, "Use an L001-style loop code.").refine((value) => !hasIdentifierRisk(value), "Loop code appears to contain an identifier."),
    loop_family: enumOf(loopFamilies),
    loop_type: enumOf(loopTypes),
    loop_specialty: enumOf(loopSpecialties),
    test_category: enumOf(testCategories).nullable(),
    referral_category: enumOf(referralCategories).nullable(),
    urgency: enumOf(urgencyOptions),
    severity: enumOf(severityOptions),
    recommended_window: enumOf(recommendedWindows),
    delay_affect_care: enumOf(yesNoUnclear),
    review_status: enumOf(reviewStatuses),
    review_day_offset: optionalInt,
    contact_status: enumOf(contactStatuses),
    contact_day_offset: optionalInt,
    action_status: enumOf(actionStatuses),
    action_day_offset: optionalInt,
    followup_scheduled_status: enumOf(followupScheduledStatuses),
    followup_scheduled_day_offset: optionalInt,
    closure_status: enumOf(closureStatuses),
    closure_day_offset: optionalInt,
    audit_age_days_if_open: optionalInt,
    first_receiver_role: enumOf(firstReceiverRoles),
    reviewer_role: enumOf(reviewerRoles),
    contact_role: enumOf(contactRoles),
    owner_role: enumOf(ownerRoles),
    closer_role: enumOf(closerRoles),
    handoff_count: enumOf(handoffCounts),
    tracking_method: enumOf(loopTrackingOptions),
    support_staff_involved: enumOf(yesNoUnclear),
    loop_communication_channel: enumOf(loopCommunicationChannels),
    clinic_load: enumOf(opdVolumes).nullable(),
    current_status: enumOf(currentStatuses),
    patient_contacted: enumOf(yesNoNotNeededUnknown),
    followup_completed: enumOf(yesNoNotNeededUnknown),
    escalation_required: enumOf(yesNoUnclear),
    emergency_referral_or_admission: enumOf(yesNoUnclear),
    care_plan_changed: enumOf(yesNoUnclear),
    evidence_source: enumOf(evidenceSources),
    confidence: enumOf(confidenceOptions),
    selection_method: enumOf(selectionMethods),
    verification_willingness: z.enum(["Yes", "No", "Maybe", ""]).transform((value) => value || null).nullable(),
  })
  .superRefine((loop, ctx) => {
    if (loop.loop_family === "Abnormal diagnostic result" && (!loop.test_category || loop.test_category === "N/A")) {
      ctx.addIssue({ code: "custom", path: ["test_category"], message: "Select the abnormal-result test category." });
    }
    if (loop.loop_family === "Referral or follow-up" && (!loop.referral_category || loop.referral_category === "N/A")) {
      ctx.addIssue({ code: "custom", path: ["referral_category"], message: "Select the referral/follow-up category." });
    }
    if (loop.review_status === "Reviewed" && loop.review_day_offset == null) {
      ctx.addIssue({ code: "custom", path: ["review_day_offset"], message: "Enter the review day offset." });
    }
    if (loop.contact_status === "Contacted" && loop.contact_day_offset == null) {
      ctx.addIssue({ code: "custom", path: ["contact_day_offset"], message: "Enter the patient contact day offset." });
    }
    if (loop.action_status === "Action documented" && loop.action_day_offset == null) {
      ctx.addIssue({ code: "custom", path: ["action_day_offset"], message: "Enter the documented action day offset." });
    }
    if (loop.followup_scheduled_status === "Scheduled" && loop.followup_scheduled_day_offset == null) {
      ctx.addIssue({ code: "custom", path: ["followup_scheduled_day_offset"], message: "Enter the scheduled follow-up day offset." });
    }
    if (["Closed", "Escalated", "Lost to follow-up", "Closed as no action needed"].includes(loop.closure_status) && loop.closure_day_offset == null) {
      ctx.addIssue({ code: "custom", path: ["closure_day_offset"], message: "Enter the closure day offset." });
    }
    if (loop.closure_status === "Still open" && loop.audit_age_days_if_open == null) {
      ctx.addIssue({ code: "custom", path: ["audit_age_days_if_open"], message: "Enter the audit age for still-open loops." });
    }
    const knownClosure = loop.closure_day_offset;
    const priorOffsets = [loop.review_day_offset, loop.action_day_offset].filter((value): value is number => value != null);
    if (knownClosure != null && priorOffsets.some((offset) => knownClosure < offset)) {
      ctx.addIssue({ code: "custom", path: ["closure_day_offset"], message: "Closure day cannot be earlier than known review/action days." });
    }
  });

export const operationsSchema = z.object({
  abnormal_result_owner_exists: enumOf(ownerExistsOptions),
  referral_owner_exists: enumOf(ownerExistsOptions),
  unresolved_review_cadence: enumOf(unresolvedReviewCadenceOptions),
  future_export_available: enumOf(futureExportAvailableOptions),
  future_approval_path: enumOf(futureApprovalPathOptions),
});

export const submissionPayloadSchema = z
  .object({
    consent: consentSchema,
    context: contextSchema,
    loops: z.array(careLoopSchema).min(6).max(10),
    operations: operationsSchema,
    final_no_identifiers: z.literal(true),
    honeypot: z.string().max(0).optional().default(""),
  })
  .refine((payload) => payload.loops.slice(0, 6).length === 6, "Exactly six required loops must be present before submission.");

export type Consent = z.infer<typeof consentSchema>;
export type RespondentContext = z.infer<typeof contextSchema>;
export type CareLoop = z.infer<typeof careLoopSchema>;
export type SiteOperations = z.infer<typeof operationsSchema>;
export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;
