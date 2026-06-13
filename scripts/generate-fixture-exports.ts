import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAnalysisReadinessReport, buildDataDictionaryRows, buildDataQualityReport, exportColumns } from "../src/lib/analytics";
import { addDerivedVariables, getLoopQualityAssessment } from "../src/lib/derived";
import { careLoopSchema } from "../src/lib/schemas";

type Row = Record<string, unknown>;
type FixtureRespondent = {
  respondent_id: string;
  submission_id: string;
  created_at: string;
  record_use_basis: string;
  respondent_role: string;
  specialty: string;
  practice_setting: string;
  opd_volume: string;
  support_staff: string[];
  record_system: string;
  lab_tracking: string;
  referral_tracking: string;
  followup_tracking: string;
  communication_channel: string;
  digital_maturity: number;
};
type LoopStatus = "Not started" | "Saved, incomplete" | "Usable for analysis";
type DerivedQualityField =
  | "quality_grade"
  | "usable_for_main_analysis"
  | "counts_toward_required_loop"
  | "evidence_strength"
  | "selection_bias_flag"
  | "censored_status"
  | "censored_time"
  | "stall_stage"
  | "impossible_timeline_flag"
  | "closure_before_review_or_action_flag";

const alignedQualityFields: DerivedQualityField[] = [
  "quality_grade",
  "usable_for_main_analysis",
  "counts_toward_required_loop",
  "evidence_strength",
  "selection_bias_flag",
  "censored_status",
  "censored_time",
  "stall_stage",
  "impossible_timeline_flag",
  "closure_before_review_or_action_flag",
];

function escapeCsv(value: unknown) {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join(";") : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Row[], columns: readonly string[]) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))].join("\n");
}

function baseRespondent(index: number): FixtureRespondent {
  return {
    respondent_id: randomUUID(),
    submission_id: randomUUID(),
    created_at: `2026-06-${String((index % 9) + 10).padStart(2, "0")}T09:00:00.000Z`,
    record_use_basis: "Mostly records",
    respondent_role: index % 2 === 0 ? "Physician" : "Nurse",
    specialty: index % 3 === 0 ? "Cardiology" : "General medicine",
    practice_setting: "Solo private clinic",
    opd_volume: "20-39",
    support_staff: ["Receptionist", "Nurse"],
    record_system: "EHR",
    lab_tracking: "Clinic software",
    referral_tracking: "Spreadsheet",
    followup_tracking: "Clinic software",
    communication_channel: "Phone",
    digital_maturity: 4,
  };
}

function baseLoop(respondent: FixtureRespondent, loopNumber: number, caseName: string): Row {
  return {
    _case_name: caseName,
    loop_id: randomUUID(),
    respondent_id: respondent.respondent_id,
    submission_id: respondent.submission_id,
    created_at: respondent.created_at,
    respondent_role: respondent.respondent_role,
    specialty: respondent.specialty,
    practice_setting: respondent.practice_setting,
    opd_volume: respondent.opd_volume,
    support_staff: respondent.support_staff,
    record_system: respondent.record_system,
    lab_tracking: respondent.lab_tracking,
    referral_tracking: respondent.referral_tracking,
    followup_tracking: respondent.followup_tracking,
    communication_channel: respondent.communication_channel,
    digital_maturity: respondent.digital_maturity,
    record_use_basis: respondent.record_use_basis,
    loop_number: loopNumber,
    loop_code: `L${String(loopNumber).padStart(3, "0")}`,
    loop_family: "Abnormal diagnostic result",
    loop_type: "Abnormal lab",
    loop_specialty: respondent.specialty,
    test_category: "HbA1c",
    referral_category: "N/A",
    urgency: "Routine",
    severity: "Moderate",
    recommended_window: "4-7 days",
    delay_affect_care: "Yes",
    review_status: "Reviewed",
    review_day_offset: 0,
    contact_status: "Contacted",
    contact_day_offset: 1,
    action_status: "Action documented",
    action_day_offset: 2,
    followup_scheduled_status: "Scheduled",
    followup_scheduled_day_offset: 3,
    closure_status: "Closed",
    closure_day_offset: 5,
    audit_age_days_if_open: null,
    first_receiver_role: "Physician",
    reviewer_role: "Physician",
    contact_role: "Nurse",
    owner_role: "Physician",
    closer_role: "Coordinator",
    handoff_count: "1",
    tracking_method: "Clinic software",
    support_staff_involved: "Yes",
    loop_communication_channel: "Phone",
    clinic_load: "20-39",
    current_status: "Resolved",
    patient_contacted: "Yes",
    followup_completed: "Yes",
    escalation_required: "No",
    emergency_referral_or_admission: "No",
    care_plan_changed: "Yes",
    evidence_source: "EHR",
    confidence: "High",
    selection_method: "Most recent consecutive loops",
    verification_willingness: "Yes",
  };
}

function fixtureRows() {
  const respondents = Array.from({ length: 11 }, (_, index) => baseRespondent(index + 1));
  const rows = respondents.map((respondent, index) => {
    const loopNumber = index + 1;
    return baseLoop(respondent, loopNumber, `case_${loopNumber}`);
  });

  rows[0] = {
    ...rows[0],
    _case_name: "closed_abnormal_lab_loop",
    loop_code: "L001",
  };

  rows[1] = {
    ...rows[1],
    _case_name: "still_open_referral_loop",
    loop_family: "Referral or follow-up",
    loop_type: "Specialist referral",
    test_category: "N/A",
    referral_category: "Cardiology",
    urgency: "Urgent",
    recommended_window: "1-3 days",
    review_day_offset: 0,
    contact_day_offset: 2,
    action_day_offset: 3,
    followup_scheduled_day_offset: null,
    followup_scheduled_status: "Not scheduled",
    closure_status: "Still open",
    closure_day_offset: null,
    audit_age_days_if_open: 14,
    current_status: "Still open",
    confidence: "Medium",
  };

  rows[2] = {
    ...rows[2],
    _case_name: "lost_to_followup_loop",
    loop_family: "Referral or follow-up",
    loop_type: "Imaging referral",
    test_category: "N/A",
    referral_category: "imaging",
    urgency: "Semi-urgent",
    recommended_window: "8-14 days",
    review_status: "Not reviewed",
    review_day_offset: null,
    contact_status: "Not contacted",
    contact_day_offset: null,
    action_status: "Action not documented",
    action_day_offset: null,
    followup_scheduled_status: "Not scheduled",
    followup_scheduled_day_offset: null,
    closure_status: "Lost to follow-up",
    closure_day_offset: 18,
    audit_age_days_if_open: null,
    current_status: "Lost to follow-up",
    patient_contacted: "No",
    followup_completed: "No",
  };

  rows[3] = {
    ...rows[3],
    _case_name: "escalated_loop",
    urgency: "Critical",
    recommended_window: "Same day",
    review_status: "Not reviewed",
    review_day_offset: null,
    contact_status: "Not contacted",
    contact_day_offset: null,
    action_status: "Action not documented",
    action_day_offset: null,
    followup_scheduled_status: "Not scheduled",
    followup_scheduled_day_offset: null,
    closure_status: "Escalated",
    closure_day_offset: 0,
    current_status: "Escalated",
    escalation_required: "Yes",
    emergency_referral_or_admission: "Yes",
  };

  rows[4] = {
    ...rows[4],
    _case_name: "closed_as_no_action_needed",
    action_status: "No action needed",
    action_day_offset: null,
    followup_scheduled_status: "Not needed",
    followup_scheduled_day_offset: null,
    closure_status: "Closed as no action needed",
    closure_day_offset: 1,
    current_status: "Closed as no action needed",
    care_plan_changed: "No",
  };

  rows[5] = {
    ...rows[5],
    _case_name: "memory_only_low_confidence_loop",
    evidence_source: "Physician memory",
    confidence: "Low",
    review_status: "Not reviewed",
    review_day_offset: null,
    contact_status: "Not contacted",
    contact_day_offset: null,
    action_status: "Action not documented",
    action_day_offset: null,
    followup_scheduled_status: "Not scheduled",
    followup_scheduled_day_offset: null,
    closure_day_offset: 9,
  };

  rows[6] = {
    ...rows[6],
    _case_name: "record_backed_high_confidence_loop",
    evidence_source: "Lab log",
    confidence: "High",
    test_category: "renal function",
    loop_code: "L007",
  };

  rows[7] = {
    ...rows[7],
    _case_name: "high_risk_selected_loop",
    selection_method: "High-risk examples only",
    urgency: "Urgent",
    recommended_window: "1-3 days",
    review_status: "Not reviewed",
    review_day_offset: null,
    contact_status: "Not contacted",
    contact_day_offset: null,
    action_status: "Action not documented",
    action_day_offset: null,
    followup_scheduled_status: "Not scheduled",
    followup_scheduled_day_offset: null,
    closure_status: "Closed",
    closure_day_offset: 4,
    current_status: "Resolved",
    evidence_source: "Paper chart",
    confidence: "Medium",
  };

  rows[8] = {
    ...rows[8],
    _case_name: "unknown_timeline_loop",
    urgency: "Unclear",
    recommended_window: "Unclear",
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
    current_status: "Unknown",
    confidence: "Medium",
  };

  rows[9] = {
    ...rows[9],
    _case_name: "suspicious_identifier_like_text",
    loop_code: "patient-9876543210",
    review_day_offset: 0,
    contact_day_offset: 1,
    action_day_offset: 2,
    closure_day_offset: 4,
    current_status: "Resolved",
  };

  rows[10] = {
    ...rows[10],
    _case_name: "borderline_saved_not_counted_loop",
    loop_family: "Referral or follow-up",
    loop_type: "Specialist referral",
    test_category: "N/A",
    referral_category: "Neurology",
    urgency: "Unclear",
    recommended_window: "4-7 days",
    review_status: "Reviewed",
    review_day_offset: 1,
    contact_status: "Unknown",
    contact_day_offset: null,
    action_status: "Unknown",
    action_day_offset: null,
    followup_scheduled_status: "Unknown",
    followup_scheduled_day_offset: null,
    closure_status: "Still open",
    closure_day_offset: null,
    audit_age_days_if_open: 6,
    current_status: "Still open",
    evidence_source: "Paper chart",
    confidence: "Medium",
    selection_method: "Most recent consecutive loops",
  };

  return {
    respondents,
    rawWideRows: rows,
  };
}

function frontendEquivalentStatus(row: Row): LoopStatus {
  const schemaReady = careLoopSchema.safeParse(row).success;
  const quality = getLoopQualityAssessment(row);
  return schemaReady && quality.counts_toward_required_loop ? "Usable for analysis" : "Saved, incomplete";
}

function main() {
  const outputDir = join(process.cwd(), "tmp", "analytics-fixtures");
  mkdirSync(outputDir, { recursive: true });

  const { respondents, rawWideRows } = fixtureRows();
  const analysisRows = rawWideRows.map((row) => addDerivedVariables(row));
  const excludedRows = analysisRows.filter((row) => row.quality_grade === "D" || row.usable_for_main_analysis !== true);
  const qualityReport = buildDataQualityReport(analysisRows, respondents);
  const readinessReport = buildAnalysisReadinessReport(analysisRows);
  const dictionaryRows = buildDataDictionaryRows();

  const files: Record<string, Row[]> = {
    "raw_wide_export.csv": rawWideRows,
    "analysis_ready_loops.csv": analysisRows,
    "respondents.csv": respondents,
    "excluded_or_low_quality_rows.csv": excludedRows,
    "data_quality_report.csv": qualityReport,
    "analysis_readiness_report.csv": readinessReport,
    "data_dictionary.csv": dictionaryRows,
  };

  for (const [file, rows] of Object.entries(files)) {
    const columns = exportColumns[file];
    if (!columns) throw new Error(`Missing export column definition for ${file}`);
    writeFileSync(join(outputDir, file), toCsv(rows, columns), "utf8");
  }

  const expectedGrades = new Map([
    ["closed_abnormal_lab_loop", "A"],
    ["still_open_referral_loop", "A"],
    ["lost_to_followup_loop", "A"],
    ["escalated_loop", "A"],
    ["closed_as_no_action_needed", "A"],
    ["memory_only_low_confidence_loop", "C"],
    ["record_backed_high_confidence_loop", "A"],
    ["high_risk_selected_loop", "A"],
    ["unknown_timeline_loop", "D"],
    ["suspicious_identifier_like_text", "D"],
    ["borderline_saved_not_counted_loop", "D"],
  ]);

  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

  checks.push({
    name: "one_row_per_loop",
    pass: analysisRows.length === 11,
    detail: `${analysisRows.length} analysis rows generated`,
  });

  for (const [index, row] of analysisRows.entries()) {
    const caseName = String(row._case_name);
    const expectedGrade = expectedGrades.get(caseName);
    const sharedAssessment = getLoopQualityAssessment(rawWideRows[index]);
    const dashboardStatus = frontendEquivalentStatus(rawWideRows[index]);
    const reviewStatus = frontendEquivalentStatus(rawWideRows[index]);

    checks.push({
      name: `quality_grade_${caseName}`,
      pass: row.quality_grade === expectedGrade,
      detail: `expected ${expectedGrade}, got ${String(row.quality_grade)}`,
    });

    for (const field of alignedQualityFields) {
      checks.push({
        name: `frontend_export_alignment_${caseName}_${field}`,
        pass: row[field] === sharedAssessment[field],
        detail: `frontend/shared=${String(sharedAssessment[field])}, export=${String(row[field])}`,
      });
    }

    checks.push({
      name: `review_dashboard_alignment_${caseName}`,
      pass: dashboardStatus === reviewStatus,
      detail: `dashboard=${dashboardStatus}, review=${reviewStatus}`,
    });

    checks.push({
      name: `frontend_status_matches_export_${caseName}`,
      pass:
        (dashboardStatus === "Usable for analysis") ===
        (row.counts_toward_required_loop === true && row.usable_for_main_analysis === true),
      detail: `frontend=${dashboardStatus}, counts=${String(row.counts_toward_required_loop)}, usable=${String(row.usable_for_main_analysis)}`,
    });
  }

  const stillOpen = analysisRows.find((row) => row._case_name === "still_open_referral_loop");
  checks.push({
    name: "still_open_censoring",
    pass: stillOpen?.censored_status === 1 && stillOpen?.censored_time === 14,
    detail: `censored_status=${String(stillOpen?.censored_status)}, censored_time=${String(stillOpen?.censored_time)}`,
  });

  const suspicious = analysisRows.find((row) => row._case_name === "suspicious_identifier_like_text");
  checks.push({
    name: "identifier_flag_triggered",
    pass: suspicious?.possible_identifier_flag === true,
    detail: `possible_identifier_flag=${String(suspicious?.possible_identifier_flag)}`,
  });

  checks.push({
    name: "low_quality_rows_preserved",
    pass: excludedRows.length >= 2,
    detail: `${excludedRows.length} rows written to excluded_or_low_quality_rows.csv`,
  });

  const highRisk = analysisRows.find((row) => row._case_name === "high_risk_selected_loop");
  checks.push({
    name: "selection_bias_flag_high_risk",
    pass: highRisk?.selection_bias_flag === true,
    detail: `selection_bias_flag=${String(highRisk?.selection_bias_flag)}`,
  });

  const closedLoop = analysisRows.find((row) => row._case_name === "closed_abnormal_lab_loop");
  checks.push({
    name: "risk_weighted_delay_computed",
    pass: typeof closedLoop?.risk_weighted_delay === "number",
    detail: `risk_weighted_delay=${String(closedLoop?.risk_weighted_delay)}`,
  });

  const borderline = analysisRows.find((row) => row._case_name === "borderline_saved_not_counted_loop");
  const borderlineStatus = frontendEquivalentStatus(rawWideRows.find((row) => row._case_name === "borderline_saved_not_counted_loop") ?? {});
  checks.push({
    name: "borderline_saved_not_counted_regression",
    pass:
      borderline?.quality_grade === "D" &&
      borderline?.usable_for_main_analysis === false &&
      borderline?.counts_toward_required_loop === false &&
      borderlineStatus === "Saved, incomplete",
    detail: `grade=${String(borderline?.quality_grade)}, usable=${String(borderline?.usable_for_main_analysis)}, counts=${String(borderline?.counts_toward_required_loop)}, frontend=${borderlineStatus}`,
  });

  for (const check of checks) {
    const status = check.pass ? "PASS" : "FAIL";
    console.log(`${status} ${check.name}: ${check.detail}`);
  }

  console.log(`\nFixture exports written to ${outputDir}`);
}

main();
