import type { RowLike } from "@/lib/schemas";

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

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isClosed(status: unknown) {
  return status === "Closed" || status === "Resolved" || status === "Closed as no action needed";
}

export function addDerivedVariables<T extends RowLike>(row: T) {
  const daysToReview = row.review_status === "Reviewed" ? num(row.review_day_offset) : null;
  const daysToContact = row.contact_status === "Contacted" ? num(row.contact_day_offset) : null;
  const daysToAction = row.action_status === "Action documented" ? num(row.action_day_offset) : null;
  const daysToFollowupScheduled = row.followup_scheduled_status === "Scheduled" ? num(row.followup_scheduled_day_offset) : null;
  const daysToClosure = isClosed(row.closure_status) ? num(row.closure_day_offset) : null;
  const windowDays = recommendedWindowDays[String(row.recommended_window)] ?? null;
  const urgencyWeight = urgencyWeights[String(row.urgency)] ?? null;
  const censoredStatus = daysToClosure == null ? 1 : 0;
  const censoredTime = row.closure_status === "Still open" ? num(row.audit_age_days_if_open) : null;
  const daysOverdue = daysToClosure != null && windowDays != null ? daysToClosure - windowDays : null;
  const positiveDaysOverdue = daysOverdue != null ? Math.max(daysOverdue, 0) : null;
  const riskWeightedDelay =
    positiveDaysOverdue != null && urgencyWeight != null ? positiveDaysOverdue * urgencyWeight : null;

  return {
    ...row,
    days_to_review: daysToReview,
    days_to_contact: daysToContact,
    days_to_action: daysToAction,
    days_to_followup_scheduled: daysToFollowupScheduled,
    days_to_closure: daysToClosure,
    censored_status: censoredStatus,
    censored_time: censoredTime,
    recommended_window_days: windowDays,
    days_overdue: daysOverdue,
    positive_days_overdue: positiveDaysOverdue,
    urgency_weight: urgencyWeight,
    risk_weighted_delay: riskWeightedDelay,
    stall_stage: stallStage(row),
  };
}

export function stallStage(row: RowLike) {
  if (row.review_status === "Not reviewed" && !isClosed(row.closure_status)) return "pre_review";
  if (row.review_status === "Reviewed" && row.contact_status === "Not contacted") return "contact";
  if (row.contact_status === "Contacted" && row.action_status === "Action not documented") return "action";
  if (row.action_status === "Action documented" && row.followup_scheduled_status === "Not scheduled") return "scheduling";
  if (row.followup_scheduled_status === "Scheduled" && ["Still open", "Lost to follow-up", "Unknown"].includes(String(row.current_status))) {
    return "closure_or_followup_completion";
  }
  if (row.closure_status === "Lost to follow-up") return "lost_to_followup";
  if (
    row.review_status === "Unknown" ||
    row.contact_status === "Unknown" ||
    row.action_status === "Unknown" ||
    row.closure_status === "Unknown"
  ) {
    return "documentation_unknown";
  }
  return "closed_or_no_stall_identified";
}
