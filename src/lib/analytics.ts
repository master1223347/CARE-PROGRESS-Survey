import type { RowLike } from "@/lib/schemas";

const rawWideColumns = [
  "loop_id",
  "respondent_id",
  "submission_id",
  "created_at",
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
  "record_use_basis",
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
  "delay_affect_care",
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
] as const;

const analysisReadyColumns = [
  ...rawWideColumns,
  "recommended_window_days_numeric",
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
  "evidence_strength",
  "selection_bias_flag",
  "possible_identifier_flag",
  "usable_for_main_analysis",
  "counts_toward_required_loop",
  "quality_grade",
  "lost_to_followup_flag",
  "escalated_flag",
  "closure_before_review_or_action_flag",
  "impossible_timeline_flag",
] as const;

export const exportColumns: Record<string, readonly string[]> = {
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
  "care_loops.csv": analysisReadyColumns,
  "raw_wide_export.csv": rawWideColumns,
  "analysis_ready_loops.csv": analysisReadyColumns,
  "excluded_or_low_quality_rows.csv": analysisReadyColumns,
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
  "data_quality_report.csv": ["section", "metric", "group", "value"],
  "analysis_readiness_report.csv": ["check_name", "status", "detail"],
  "data_dictionary.csv": ["field_name", "type", "allowed_values", "required", "description", "raw_or_derived", "missing_value_rules"],
};

function numericValues(rows: RowLike[], key: string) {
  return rows
    .map((row) => row[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
}

function median(values: number[]) {
  if (!values.length) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
}

function percentage(count: number, total: number) {
  if (!total) return 0;
  return Number(((count / total) * 100).toFixed(2));
}

function countBy(rows: RowLike[], key: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key] ?? "");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function addDistributionRows(rows: Array<Record<string, string | number>>, section: string, metric: string, counts: Map<string, number>) {
  for (const [group, value] of counts.entries()) {
    rows.push({ section, metric, group, value });
  }
}

export function buildDataQualityReport(rows: RowLike[], respondents: RowLike[]) {
  const report: Array<Record<string, string | number>> = [];
  const totalLoops = rows.length;

  report.push({ section: "overview", metric: "total_respondents", group: "", value: respondents.length });
  report.push({ section: "overview", metric: "total_care_loops", group: "", value: totalLoops });

  addDistributionRows(report, "distribution", "loops_by_family", countBy(rows, "loop_family"));
  addDistributionRows(report, "distribution", "loops_by_type", countBy(rows, "loop_type"));
  addDistributionRows(report, "distribution", "loops_by_urgency", countBy(rows, "urgency"));
  addDistributionRows(report, "distribution", "loops_by_evidence_strength", countBy(rows, "evidence_strength"));
  addDistributionRows(report, "distribution", "loops_by_quality_grade", countBy(rows, "quality_grade"));

  for (const grade of ["A", "B", "C", "D"]) {
    const count = rows.filter((row) => row.quality_grade === grade).length;
    report.push({ section: "quality", metric: `percent_grade_${grade.toLowerCase()}`, group: "", value: percentage(count, totalLoops) });
  }

  report.push({
    section: "quality",
    metric: "percent_usable_for_main_analysis",
    group: "",
    value: percentage(rows.filter((row) => row.usable_for_main_analysis === true).length, totalLoops),
  });
  report.push({
    section: "quality",
    metric: "percent_memory_based",
    group: "",
    value: percentage(rows.filter((row) => row.evidence_strength === "memory_based").length, totalLoops),
  });
  report.push({
    section: "missingness",
    metric: "percent_missing_closure_status",
    group: "",
    value: percentage(rows.filter((row) => row.closure_status === "Unknown").length, totalLoops),
  });
  report.push({
    section: "missingness",
    metric: "percent_missing_recommended_window",
    group: "",
    value: percentage(rows.filter((row) => row.recommended_window === "Unclear").length, totalLoops),
  });
  report.push({
    section: "missingness",
    metric: "percent_missing_urgency",
    group: "",
    value: percentage(rows.filter((row) => row.urgency === "Unclear").length, totalLoops),
  });
  report.push({
    section: "missingness",
    metric: "percent_still_open_or_censored",
    group: "",
    value: percentage(rows.filter((row) => row.censored_status === 1).length, totalLoops),
  });
  report.push({
    section: "missingness",
    metric: "percent_patient_contact_unknown",
    group: "",
    value: percentage(rows.filter((row) => row.contact_status === "Unknown").length, totalLoops),
  });
  report.push({
    section: "missingness",
    metric: "percent_evidence_source_other",
    group: "",
    value: percentage(rows.filter((row) => row.evidence_source === "Other").length, totalLoops),
  });
  report.push({
    section: "bias",
    metric: "percent_selection_method_high_risk_examples_only",
    group: "",
    value: percentage(rows.filter((row) => row.selection_method === "High-risk examples only").length, totalLoops),
  });
  report.push({
    section: "quality",
    metric: "rows_removed_or_excluded_from_main_analysis",
    group: "",
    value: rows.filter((row) => row.usable_for_main_analysis !== true || row.quality_grade === "D").length,
  });

  const families = Array.from(new Set(rows.map((row) => String(row.loop_family))));
  for (const family of families) {
    const familyRows = rows.filter((row) => row.loop_family === family);
    report.push({
      section: "timing",
      metric: "median_days_to_closure",
      group: family,
      value: median(numericValues(familyRows, "days_to_closure")) ?? "",
    });
    report.push({
      section: "timing",
      metric: "median_risk_weighted_delay",
      group: family,
      value: median(numericValues(familyRows, "risk_weighted_delay")) ?? "",
    });
  }

  return report;
}

export function buildAnalysisReadinessReport(rows: RowLike[]) {
  const checks: Array<Record<string, string>> = [];
  const offsetFields = [
    "review_day_offset",
    "contact_day_offset",
    "action_day_offset",
    "followup_scheduled_day_offset",
    "closure_day_offset",
    "audit_age_days_if_open",
  ];
  const requiredFields = [
    "respondent_id",
    "loop_id",
    "loop_family",
    "loop_type",
    "urgency",
    "recommended_window",
    "current_status",
    "evidence_source",
    "confidence",
    "selection_method",
  ];

  const missingLoopId = rows.filter((row) => !row.loop_id).length;
  const missingRespondentId = rows.filter((row) => !row.respondent_id).length;
  checks.push({
    check_name: "loop_ids_present",
    status: missingLoopId === 0 ? "PASS" : "FAIL",
    detail: `${missingLoopId} rows missing loop_id`,
  });
  checks.push({
    check_name: "respondent_ids_present",
    status: missingRespondentId === 0 ? "PASS" : "FAIL",
    detail: `${missingRespondentId} rows missing respondent_id`,
  });

  const requiredMissing = rows.filter((row) => requiredFields.some((field) => row[field] == null || row[field] === "")).length;
  checks.push({
    check_name: "required_fields_present",
    status: requiredMissing === 0 ? "PASS" : "FAIL",
    detail: `${requiredMissing} rows missing one or more required analysis fields`,
  });

  const badOffsets = rows.filter((row) =>
    offsetFields.some((field) => row[field] != null && (!Number.isInteger(row[field]) || Number(row[field]) < 0)),
  ).length;
  checks.push({
    check_name: "day_offsets_are_integers_or_null",
    status: badOffsets === 0 ? "PASS" : "FAIL",
    detail: `${badOffsets} rows have invalid day offsets`,
  });

  const impossibleTimelines = rows.filter((row) => row.impossible_timeline_flag === true).length;
  checks.push({
    check_name: "impossible_timelines_flagged",
    status: impossibleTimelines === 0 ? "PASS" : "WARNING",
    detail: `${impossibleTimelines} rows flagged with impossible timelines`,
  });

  const closureBeforeReview = rows.filter((row) => row.closure_before_review_or_action_flag === true).length;
  checks.push({
    check_name: "closure_before_review_or_action_flagged",
    status: closureBeforeReview === 0 ? "PASS" : "WARNING",
    detail: `${closureBeforeReview} rows close before review/action`,
  });

  const gradeAB = rows.filter((row) => row.quality_grade === "A" || row.quality_grade === "B").length;
  checks.push({
    check_name: "grade_a_b_count",
    status: gradeAB > 0 ? "PASS" : "WARNING",
    detail: `${gradeAB} rows are Grade A or B`,
  });

  const usableRows = rows.filter((row) => row.usable_for_main_analysis === true).length;
  checks.push({
    check_name: "usable_for_main_analysis_count",
    status: usableRows >= 6 ? "PASS" : usableRows > 0 ? "WARNING" : "FAIL",
    detail: `${usableRows} rows usable for main analysis`,
  });

  const memoryOrUnclearEvidence = rows.filter(
    (row) => row.evidence_strength === "memory_based" || row.evidence_strength === "unclear",
  ).length;
  checks.push({
    check_name: "evidence_strength_distribution",
    status: percentage(memoryOrUnclearEvidence, rows.length) > 50 ? "WARNING" : "PASS",
    detail: `${memoryOrUnclearEvidence}/${rows.length} rows are memory-based or unclear`,
  });

  for (const field of ["urgency", "recommended_window", "closure_status", "current_status", "selection_method"]) {
    const missing = rows.filter((row) => row[field] === "Unknown" || row[field] === "Unclear" || row[field] == null).length;
    checks.push({
      check_name: `missingness_${field}`,
      status: percentage(missing, rows.length) > 20 ? "WARNING" : "PASS",
      detail: `${missing}/${rows.length} rows missing or unclear for ${field}`,
    });
  }

  return checks;
}

type DictionaryRow = {
  field_name: string;
  type: string;
  allowed_values: string;
  required: string;
  description: string;
  raw_or_derived: string;
  missing_value_rules: string;
};

function dictionaryRow(row: DictionaryRow) {
  return row;
}

export function buildDataDictionaryRows() {
  return [
    dictionaryRow({ field_name: "loop_id", type: "uuid", allowed_values: "generated UUID", required: "yes", description: "Unique loop identifier", raw_or_derived: "raw", missing_value_rules: "must be present" }),
    dictionaryRow({ field_name: "respondent_id", type: "uuid", allowed_values: "generated UUID", required: "yes", description: "Links loop to respondent/site context", raw_or_derived: "raw", missing_value_rules: "must be present" }),
    dictionaryRow({ field_name: "loop_family", type: "text", allowed_values: "Abnormal diagnostic result; Referral or follow-up", required: "yes", description: "High-level care-loop family", raw_or_derived: "raw", missing_value_rules: "no missing allowed" }),
    dictionaryRow({ field_name: "loop_type", type: "text", allowed_values: "survey enum", required: "yes", description: "Specific care-loop type", raw_or_derived: "raw", missing_value_rules: "Other without clarification lowers quality grade" }),
    dictionaryRow({ field_name: "urgency", type: "text", allowed_values: "Routine; Semi-urgent; Urgent; Critical; Unclear", required: "yes", description: "Clinical urgency at the time of the example", raw_or_derived: "raw", missing_value_rules: "Unclear treated as missing for main analysis" }),
    dictionaryRow({ field_name: "recommended_window", type: "text", allowed_values: "Same day; 1-3 days; 4-7 days; 8-14 days; 15-30 days; >30 days; Unclear", required: "yes", description: "Recommended closure window category", raw_or_derived: "raw", missing_value_rules: "Unclear treated as missing for main analysis" }),
    dictionaryRow({ field_name: "current_status", type: "text", allowed_values: "Resolved; Still open; Lost to follow-up; Escalated; Closed as no action needed; Unknown", required: "yes", description: "Best overall status at audit", raw_or_derived: "raw", missing_value_rules: "Unknown lowers quality grade to D" }),
    dictionaryRow({ field_name: "review_day_offset", type: "integer", allowed_values: "0+", required: "conditional", description: "Days from Day 0 to clinical review", raw_or_derived: "raw", missing_value_rules: "null if review not known or not needed" }),
    dictionaryRow({ field_name: "contact_day_offset", type: "integer", allowed_values: "0+", required: "conditional", description: "Days from Day 0 to patient contact", raw_or_derived: "raw", missing_value_rules: "null if contact not known or not needed" }),
    dictionaryRow({ field_name: "action_day_offset", type: "integer", allowed_values: "0+", required: "conditional", description: "Days from Day 0 to documented action", raw_or_derived: "raw", missing_value_rules: "null if action not known or not documented" }),
    dictionaryRow({ field_name: "followup_scheduled_day_offset", type: "integer", allowed_values: "0+", required: "conditional", description: "Days from Day 0 to follow-up scheduling", raw_or_derived: "raw", missing_value_rules: "null if not scheduled or unknown" }),
    dictionaryRow({ field_name: "closure_day_offset", type: "integer", allowed_values: "0+", required: "conditional", description: "Days from Day 0 to closure/final state", raw_or_derived: "raw", missing_value_rules: "null if still open or unknown" }),
    dictionaryRow({ field_name: "audit_age_days_if_open", type: "integer", allowed_values: "0+", required: "conditional", description: "Age of still-open loop at audit", raw_or_derived: "raw", missing_value_rules: "null unless closure_status = Still open" }),
    dictionaryRow({ field_name: "evidence_source", type: "text", allowed_values: "survey enum", required: "yes", description: "Primary evidence source used for row completion", raw_or_derived: "raw", missing_value_rules: "missing lowers quality grade to D" }),
    dictionaryRow({ field_name: "confidence", type: "text", allowed_values: "Low; Medium; High", required: "yes", description: "Confidence in row accuracy", raw_or_derived: "raw", missing_value_rules: "missing lowers quality grade to D" }),
    dictionaryRow({ field_name: "selection_method", type: "text", allowed_values: "survey enum", required: "yes", description: "How the loop was selected", raw_or_derived: "raw", missing_value_rules: "Unknown sets selection_bias_flag = true" }),
    dictionaryRow({ field_name: "recommended_window_days_numeric", type: "integer", allowed_values: "0; 3; 7; 14; 30; 60", required: "derived", description: "Numeric mapping of recommended window", raw_or_derived: "derived", missing_value_rules: "null when recommended_window = Unclear" }),
    dictionaryRow({ field_name: "days_to_review", type: "integer", allowed_values: "0+", required: "derived", description: "Review timing target for regression", raw_or_derived: "derived", missing_value_rules: "null unless review_status = Reviewed" }),
    dictionaryRow({ field_name: "days_to_contact", type: "integer", allowed_values: "0+", required: "derived", description: "Contact timing target for regression", raw_or_derived: "derived", missing_value_rules: "null unless contact_status = Contacted" }),
    dictionaryRow({ field_name: "days_to_action", type: "integer", allowed_values: "0+", required: "derived", description: "Action timing target for regression", raw_or_derived: "derived", missing_value_rules: "null unless action_status = Action documented" }),
    dictionaryRow({ field_name: "days_to_followup_scheduled", type: "integer", allowed_values: "0+", required: "derived", description: "Scheduling timing target", raw_or_derived: "derived", missing_value_rules: "null unless followup_scheduled_status = Scheduled" }),
    dictionaryRow({ field_name: "days_to_closure", type: "integer", allowed_values: "0+", required: "derived", description: "Closure timing target", raw_or_derived: "derived", missing_value_rules: "null unless closure day is known" }),
    dictionaryRow({ field_name: "censored_status", type: "integer", allowed_values: "0;1", required: "derived", description: "0 if closure day known, 1 if censored", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "censored_time", type: "integer", allowed_values: "0+", required: "derived", description: "Time used for survival analysis", raw_or_derived: "derived", missing_value_rules: "null if neither closure day nor still-open audit age is known" }),
    dictionaryRow({ field_name: "days_overdue", type: "integer", allowed_values: "integer", required: "derived", description: "days_to_closure minus recommended window", raw_or_derived: "derived", missing_value_rules: "null if closure or recommended window unknown" }),
    dictionaryRow({ field_name: "positive_days_overdue", type: "integer", allowed_values: "0+", required: "derived", description: "Non-negative overdue days", raw_or_derived: "derived", missing_value_rules: "null if days_overdue null" }),
    dictionaryRow({ field_name: "urgency_weight", type: "integer", allowed_values: "1;2;3;5", required: "derived", description: "Numeric urgency mapping", raw_or_derived: "derived", missing_value_rules: "null when urgency = Unclear" }),
    dictionaryRow({ field_name: "risk_weighted_delay", type: "number", allowed_values: "0+", required: "derived", description: "positive_days_overdue multiplied by urgency_weight", raw_or_derived: "derived", missing_value_rules: "null unless all source values known" }),
    dictionaryRow({ field_name: "stall_stage", type: "text", allowed_values: "pre_review; patient_contact; documented_action; followup_scheduling; closure; lost_to_followup; escalated; no_action_needed; unresolved_unknown_stage; insufficient_data", required: "derived", description: "Derived point where progression appears to stall", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "evidence_strength", type: "text", allowed_values: "record_backed; mixed; memory_based; unclear", required: "derived", description: "Evidence-strength class used for sensitivity analysis", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "selection_bias_flag", type: "boolean", allowed_values: "true; false", required: "derived", description: "Flags convenience/high-risk/unknown selection", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "possible_identifier_flag", type: "boolean", allowed_values: "true; false", required: "derived", description: "Flags possible identifier-like content in user-entered text", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "usable_for_main_analysis", type: "boolean", allowed_values: "true; false", required: "derived", description: "Minimum usable threshold for core modeling set", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "counts_toward_required_loop", type: "boolean", allowed_values: "true; false", required: "derived", description: "Frontend/admin required-six loop counter", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "quality_grade", type: "text", allowed_values: "A; B; C; D", required: "derived", description: "Row-level data quality grade", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "lost_to_followup_flag", type: "boolean", allowed_values: "true; false", required: "derived", description: "Binary modeling target for lost to follow-up", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "escalated_flag", type: "boolean", allowed_values: "true; false", required: "derived", description: "Binary modeling target for escalation", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "closure_before_review_or_action_flag", type: "boolean", allowed_values: "true; false", required: "derived", description: "Flags impossible or suspicious orderings", raw_or_derived: "derived", missing_value_rules: "always computed" }),
    dictionaryRow({ field_name: "impossible_timeline_flag", type: "boolean", allowed_values: "true; false", required: "derived", description: "Flags invalid negative/impossible timing values", raw_or_derived: "derived", missing_value_rules: "always computed" }),
  ];
}
