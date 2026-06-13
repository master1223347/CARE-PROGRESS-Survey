import { NextRequest, NextResponse } from "next/server";
import { buildAnalysisReadinessReport, buildDataDictionaryRows, buildDataQualityReport, exportColumns } from "@/lib/analytics";
import { addDerivedVariables } from "@/lib/derived";
import { getSupabaseAdmin } from "@/lib/supabase";

type Params = { params: Promise<{ file: string }> };
type Row = Record<string, unknown>;

function escapeCsv(value: unknown) {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join(";") : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Row[], columns: readonly string[]) {
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

async function fetchExportContext() {
  const [respondents, loops, timelines, paths, outcomes, evidence, operations] = await Promise.all([
    fetchTable("respondents"),
    fetchTable("care_loops"),
    fetchTable("event_timeline"),
    fetchTable("workflow_path"),
    fetchTable("resolution_outcomes"),
    fetchTable("evidence_quality"),
    fetchTable("site_operations"),
  ]);

  const respondentMap = mapBy(respondents, "respondent_id");
  const timelineMap = mapBy(timelines, "loop_id");
  const pathMap = mapBy(paths, "loop_id");
  const outcomeMap = mapBy(outcomes, "loop_id");
  const evidenceMap = mapBy(evidence, "loop_id");
  const operationsMap = mapBy(operations, "respondent_id");

  const rawWideRows = loops.map((loop) => {
    const respondent = respondentMap.get(String(loop.respondent_id)) ?? {};
    return {
      ...loop,
      submission_id: respondent.submission_id,
      created_at: respondent.created_at ?? loop.created_at,
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
      ...timelineMap.get(String(loop.loop_id)),
      ...pathMap.get(String(loop.loop_id)),
      ...outcomeMap.get(String(loop.loop_id)),
      ...evidenceMap.get(String(loop.loop_id)),
      ...operationsMap.get(String(loop.respondent_id)),
    };
  });

  const analysisReadyRows = rawWideRows.map((row) => addDerivedVariables(row));

  return {
    respondents,
    rawWideRows,
    analysisReadyRows,
  };
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
    const { respondents, rawWideRows, analysisReadyRows } = await fetchExportContext();

    let rows: Row[];
    if (file === "raw_wide_export.csv") {
      rows = rawWideRows;
    } else if (file === "care_loops.csv" || file === "analysis_ready_loops.csv") {
      rows = analysisReadyRows;
    } else if (file === "excluded_or_low_quality_rows.csv") {
      rows = analysisReadyRows.filter((row) => row.quality_grade === "D" || row.usable_for_main_analysis !== true);
    } else if (file === "data_quality_report.csv") {
      rows = buildDataQualityReport(analysisReadyRows, respondents);
    } else if (file === "analysis_readiness_report.csv") {
      rows = buildAnalysisReadinessReport(analysisReadyRows);
    } else if (file === "data_dictionary.csv") {
      rows = buildDataDictionaryRows();
    } else {
      rows = await fetchTable(file.replace(".csv", ""));
    }

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
