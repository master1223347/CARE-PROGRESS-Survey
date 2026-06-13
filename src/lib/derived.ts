import { hasIdentifierRisk } from "@/lib/privacy";
import type { RowLike } from "@/lib/schemas";

export type EvidenceStrength = "record_backed" | "mixed" | "memory_based" | "unclear";
export type QualityGrade = "A" | "B" | "C" | "D";
export type StallStage =
  | "pre_review"
  | "patient_contact"
  | "documented_action"
  | "followup_scheduling"
  | "closure"
  | "lost_to_followup"
  | "escalated"
  | "no_action_needed"
  | "unresolved_unknown_stage"
  | "insufficient_data";

export type LoopTimelineMetrics = {
  days_to_review: number | null;
  days_to_contact: number | null;
  days_to_action: number | null;
  days_to_followup_scheduled: number | null;
  days_to_closure: number | null;
  censored_status: 0 | 1;
  censored_time: number | null;
  recommended_window_days: number | null;
  recommended_window_days_numeric: number | null;
  days_overdue: number | null;
  positive_days_overdue: number | null;
  urgency_weight: number | null;
  risk_weighted_delay: number | null;
  closure_before_review_or_action_flag: boolean;
  impossible_timeline_flag: boolean;
};

export type LoopQualityAssessment = {
  evidence_strength: EvidenceStrength;
  selection_bias_flag: boolean;
  possible_identifier_flag: boolean;
  usable_for_main_analysis: boolean;
  counts_toward_required_loop: boolean;
  quality_grade: QualityGrade;
  lost_to_followup_flag: boolean;
  escalated_flag: boolean;
  stall_stage: StallStage;
  censored_status: 0 | 1;
  censored_time: number | null;
  closure_before_review_or_action_flag: boolean;
  impossible_timeline_flag: boolean;
  missing_requirements: string[];
};

const recommendedWindowDays: Record<string, number | null> = {
  "Same day": 0,
  "1-3 days": 3,
  "4-7 days": 7,
  "8-14 days": 14,
  "15-30 days": 30,
  ">30 days": 60,
  Unclear: null,
};

const urgencyWeights: Record<string, number | null> = {
  Routine: 1,
  "Semi-urgent": 2,
  Urgent: 3,
  Critical: 5,
  Unclear: null,
};

const recordBackedEvidenceSources = new Set([
  "EHR",
  "Paper chart",
  "Lab log",
  "Referral register",
  "Appointment register",
  "Staff call log",
  "Clinic software",
  "Lab portal",
]);

const memoryEvidenceSources = new Set(["Physician memory", "Staff memory"]);
const selectionBiasMethods = new Set(["Convenience sample", "High-risk examples only", "Unknown"]);

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(value: boolean) {
  return value;
}

function isKnown(value: unknown, unknownValue = "Unknown") {
  return value != null && value !== "" && value !== unknownValue;
}

function isClosed(status: unknown) {
  return status === "Closed" || status === "Resolved" || status === "Closed as no action needed";
}

function hasUsefulProgression(row: RowLike) {
  return (
    row.review_status === "Reviewed" ||
    row.review_status === "Not reviewed" ||
    row.contact_status === "Contacted" ||
    row.contact_status === "Not contacted" ||
    row.action_status === "Action documented" ||
    row.action_status === "Action not documented" ||
    row.action_status === "No action needed" ||
    row.followup_scheduled_status === "Scheduled" ||
    row.followup_scheduled_status === "Not scheduled" ||
    (isKnown(row.closure_status) && row.closure_status !== "Still open") ||
    (row.closure_status === "Still open" && num(row.audit_age_days_if_open) != null)
  );
}

function hasClosureOrCensoringInfo(row: RowLike) {
  return num(row.closure_day_offset) != null || (row.closure_status === "Still open" && num(row.audit_age_days_if_open) != null);
}

function hasUsefulTimingField(row: RowLike) {
  return (
    num(row.review_day_offset) != null ||
    num(row.contact_day_offset) != null ||
    num(row.action_day_offset) != null ||
    num(row.followup_scheduled_day_offset) != null ||
    num(row.closure_day_offset) != null ||
    num(row.audit_age_days_if_open) != null
  );
}

function hasOtherWithoutClarification(row: RowLike) {
  return row.loop_type === "Other" || row.test_category === "other" || row.referral_category === "other" || row.evidence_source === "Other";
}

function possibleIdentifierFlag(row: RowLike) {
  // The current instrument has only one user-entered text field: loop_code.
  return hasIdentifierRisk(text(row.loop_code));
}

function getMissingRequirements(row: RowLike) {
  const specificLoopKnown = isKnown(row.loop_type) && row.loop_type !== "Other";
  const urgencyKnown = row.urgency !== "Unclear";
  const windowKnown = row.recommended_window !== "Unclear";
  const currentStatusKnown = row.current_status !== "Unknown";
  const evidencePresent = isKnown(row.evidence_source);
  const confidencePresent = isKnown(row.confidence);
  const selectionKnown = row.selection_method !== "Unknown";
  const progressionKnown = hasUsefulProgression(row);

  return [
    !specificLoopKnown ? "specific loop type" : null,
    !urgencyKnown ? "clinical urgency" : null,
    !windowKnown ? "recommended closure window" : null,
    !currentStatusKnown ? "current status" : null,
    !evidencePresent ? "evidence source" : null,
    !confidencePresent ? "confidence rating" : null,
    !selectionKnown ? "selection method" : null,
    !progressionKnown ? "at least one known progression step" : null,
  ].filter((item): item is string => Boolean(item));
}

export function evidenceStrength(row: RowLike): EvidenceStrength {
  const source = text(row.evidence_source);
  const recordUseBasis = text(row.record_use_basis);

  if (memoryEvidenceSources.has(source)) return "memory_based";
  if (recordBackedEvidenceSources.has(source)) {
    return recordUseBasis === "Mixed records and memory" ? "mixed" : "record_backed";
  }
  if (source === "Mixed" || recordUseBasis === "Mixed records and memory") return "mixed";
  if (!source || source === "Unknown" || source === "Other") return "unclear";
  return "unclear";
}

export function selectionBiasFlag(row: RowLike) {
  return selectionBiasMethods.has(text(row.selection_method));
}

export function recommendedWindowDaysNumeric(value: unknown) {
  return recommendedWindowDays[text(value)] ?? null;
}

export function urgencyWeight(value: unknown) {
  return urgencyWeights[text(value)] ?? null;
}

export function minimumUsableForMainAnalysis(row: RowLike) {
  return bool(
    isKnown(row.loop_family) &&
      isKnown(row.loop_type) &&
      row.loop_type !== "Other" &&
      row.urgency !== "Unclear" &&
      row.recommended_window !== "Unclear" &&
      row.current_status !== "Unknown" &&
      isKnown(row.evidence_source) &&
      isKnown(row.confidence) &&
      row.selection_method !== "Unknown" &&
      !possibleIdentifierFlag(row) &&
      hasUsefulProgression(row),
  );
}

export function qualityGrade(row: RowLike): QualityGrade {
  const specificLoopKnown = isKnown(row.loop_type) && row.loop_type !== "Other";
  const urgencyKnown = row.urgency !== "Unclear";
  const windowKnown = row.recommended_window !== "Unclear";
  const currentStatusKnown = row.current_status !== "Unknown";
  const evidencePresent = isKnown(row.evidence_source);
  const confidencePresent = isKnown(row.confidence);
  const selectionKnown = row.selection_method !== "Unknown";
  const progressionKnown = hasUsefulProgression(row);
  const recordStrength = evidenceStrength(row);
  const mediumOrHighConfidence = row.confidence === "Medium" || row.confidence === "High";
  const identifierFlag = possibleIdentifierFlag(row);
  const vagueOther = hasOtherWithoutClarification(row);

  if (
    identifierFlag ||
    !currentStatusKnown ||
    !evidencePresent ||
    !confidencePresent ||
    !progressionKnown ||
    vagueOther
  ) {
    return "D";
  }

  if (
    specificLoopKnown &&
    urgencyKnown &&
    windowKnown &&
    currentStatusKnown &&
    (recordStrength === "record_backed" || recordStrength === "mixed") &&
    mediumOrHighConfidence &&
    selectionKnown &&
    hasUsefulTimingField(row)
  ) {
    return "A";
  }

  if (
    specificLoopKnown &&
    urgencyKnown &&
    windowKnown &&
    currentStatusKnown &&
    evidencePresent &&
    confidencePresent &&
    recordStrength !== "memory_based" &&
    row.confidence !== "Low" &&
    selectionKnown &&
    (progressionKnown || hasClosureOrCensoringInfo(row))
  ) {
    return "B";
  }

  if (specificLoopKnown && (recordStrength === "memory_based" || row.confidence === "Low" || !hasClosureOrCensoringInfo(row))) {
    return "C";
  }

  return "D";
}

export function stallStage(row: RowLike): StallStage {
  const enoughForStallLogic =
    isKnown(row.review_status) ||
    isKnown(row.contact_status) ||
    isKnown(row.action_status) ||
    isKnown(row.followup_scheduled_status) ||
    isKnown(row.closure_status) ||
    isKnown(row.current_status);

  if (!enoughForStallLogic) return "insufficient_data";
  if (row.current_status === "Lost to follow-up" || row.closure_status === "Lost to follow-up") return "lost_to_followup";
  if (row.current_status === "Escalated" || row.closure_status === "Escalated") return "escalated";
  if (row.current_status === "Closed as no action needed" || row.closure_status === "Closed as no action needed" || row.action_status === "No action needed") {
    return "no_action_needed";
  }
  if (row.review_status === "Not reviewed" && !isClosed(row.closure_status) && row.current_status !== "Resolved") {
    return "pre_review";
  }
  if (row.review_status === "Reviewed" && row.contact_status === "Not contacted") return "patient_contact";
  if (row.contact_status === "Contacted" && row.action_status === "Action not documented") return "documented_action";
  if (row.followup_scheduled_status === "Not scheduled") return "followup_scheduling";
  if ((row.current_status === "Still open" || row.closure_status === "Still open") && hasUsefulProgression(row)) return "closure";
  if (row.current_status === "Unknown" || row.closure_status === "Unknown") return "unresolved_unknown_stage";
  if (!hasUsefulProgression(row)) return "insufficient_data";
  return "closure";
}

export function getLoopTimelineMetrics(row: RowLike): LoopTimelineMetrics {
  const daysToReview = row.review_status === "Reviewed" ? num(row.review_day_offset) : null;
  const daysToContact = row.contact_status === "Contacted" ? num(row.contact_day_offset) : null;
  const daysToAction = row.action_status === "Action documented" ? num(row.action_day_offset) : null;
  const daysToFollowupScheduled = row.followup_scheduled_status === "Scheduled" ? num(row.followup_scheduled_day_offset) : null;
  const daysToClosure = isClosed(row.closure_status) ? num(row.closure_day_offset) : null;
  const windowDays = recommendedWindowDaysNumeric(row.recommended_window);
  const urgencyWeightValue = urgencyWeight(row.urgency);
  const censoredStatus = daysToClosure != null ? 0 : 1;
  const censoredTime =
    daysToClosure != null ? daysToClosure : row.closure_status === "Still open" ? num(row.audit_age_days_if_open) : null;
  const daysOverdue = daysToClosure != null && windowDays != null ? daysToClosure - windowDays : null;
  const positiveDaysOverdue = daysOverdue != null ? Math.max(daysOverdue, 0) : null;
  const riskWeightedDelay =
    positiveDaysOverdue != null && urgencyWeightValue != null ? positiveDaysOverdue * urgencyWeightValue : null;

  return {
    days_to_review: daysToReview,
    days_to_contact: daysToContact,
    days_to_action: daysToAction,
    days_to_followup_scheduled: daysToFollowupScheduled,
    days_to_closure: daysToClosure,
    censored_status: censoredStatus,
    censored_time: censoredTime,
    recommended_window_days: windowDays,
    recommended_window_days_numeric: windowDays,
    days_overdue: daysOverdue,
    positive_days_overdue: positiveDaysOverdue,
    urgency_weight: urgencyWeightValue,
    risk_weighted_delay: riskWeightedDelay,
    closure_before_review_or_action_flag:
      daysToClosure != null &&
      ((daysToReview != null && daysToClosure < daysToReview) || (daysToAction != null && daysToClosure < daysToAction)),
    impossible_timeline_flag:
      (daysToReview != null && daysToReview < 0) ||
      (daysToContact != null && daysToContact < 0) ||
      (daysToAction != null && daysToAction < 0) ||
      (daysToFollowupScheduled != null && daysToFollowupScheduled < 0) ||
      (daysToClosure != null && daysToClosure < 0) ||
      (num(row.audit_age_days_if_open) != null && num(row.audit_age_days_if_open)! < 0),
  };
}

export function getLoopQualityAssessment(row: RowLike): LoopQualityAssessment {
  const timeline = getLoopTimelineMetrics(row);
  const usableForMainAnalysis = minimumUsableForMainAnalysis(row);

  return {
    evidence_strength: evidenceStrength(row),
    selection_bias_flag: selectionBiasFlag(row),
    possible_identifier_flag: possibleIdentifierFlag(row),
    usable_for_main_analysis: usableForMainAnalysis,
    counts_toward_required_loop: usableForMainAnalysis,
    quality_grade: qualityGrade(row),
    lost_to_followup_flag: row.current_status === "Lost to follow-up" || row.closure_status === "Lost to follow-up",
    escalated_flag: row.current_status === "Escalated" || row.closure_status === "Escalated",
    stall_stage: stallStage(row),
    censored_status: timeline.censored_status,
    censored_time: timeline.censored_time,
    closure_before_review_or_action_flag: timeline.closure_before_review_or_action_flag,
    impossible_timeline_flag: timeline.impossible_timeline_flag,
    missing_requirements: getMissingRequirements(row),
  };
}

export function addDerivedVariables<T extends RowLike>(row: T) {
  const timeline = getLoopTimelineMetrics(row);
  const quality = getLoopQualityAssessment(row);

  return {
    ...row,
    ...timeline,
    ...quality,
  };
}
