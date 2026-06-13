# CARE-PROGRESS India Survey

CARE-PROGRESS India is a secure, mobile-first research survey for collecting de-identified outpatient care-loop audit data from doctors and clinic staff.

The app captures:
- respondent and site context
- 6 required care-loop audits
- optional loops up to 10 total
- operational readiness and future verification context
- protected CSV exports for research use

It is designed to be fast, clinically plainspoken, and usable on phones in a busy outpatient setting. The survey uses loop codes, relative day offsets, and role-based workflow fields instead of patient identifiers or free text.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Zod validation

## Setup

1. Create a Supabase project.
2. Run [docs/supabase-schema.sql](docs/supabase-schema.sql) in the Supabase SQL editor.
3. Copy [`.env.example`](.env.example) to [`.env.local`](.env.local).
4. Fill in:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EXPORT_PASSWORD=your-admin-password
```
5. Install dependencies and run the app:
```bash
npm install
npm run dev
```

## Routes

- `/` survey flow
- `/admin` protected CSV export UI
- `/api/submissions` survey submission endpoint
- `/api/admin/export/[file]` CSV export endpoint

## Export Files

The admin export route now supports both raw and analysis-oriented files:

- `raw_wide_export.csv`: one wide row per loop with collected fields only
- `analysis_ready_loops.csv`: one row per loop with raw fields plus derived timing, censoring, quality, and modeling columns
- `respondents.csv`: respondent and clinic context
- `care_loops.csv`: analysis-ready loop export kept for backward compatibility
- `event_timeline.csv`, `workflow_path.csv`, `resolution_outcomes.csv`, `evidence_quality.csv`, `site_operations.csv`: normalized operational tables
- `data_quality_report.csv`: aggregate dataset quality and missingness summary
- `analysis_readiness_report.csv`: PASS/WARNING/FAIL checks for export readiness
- `excluded_or_low_quality_rows.csv`: preserved Grade D or non-main-analysis rows
- `data_dictionary.csv`: raw and derived field definitions

## Main Analysis Rules

- Rows count toward main analysis only when `usable_for_main_analysis = true`.
- `quality_grade` is computed as:
  - `A`: specific loop, known urgency/window/current status, record-backed or mixed evidence, medium/high confidence, known timing field
  - `B`: analytically usable row with weaker or more partial timing than Grade A
  - `C`: mainly memory-based or low-confidence row, usable for sensitivity analysis only
  - `D`: vague, identifier-risk, missing key fields, or not interpretable for main analysis
- `censored_status = 1` indicates a loop is still open or closure timing is unknown.
- `censored_time` uses `closure_day_offset` when closed and `audit_age_days_if_open` when still open.

## Claims Boundary

- Do not claim patient harm from this pilot dataset unless independently verified outcomes are collected later.
- Appropriate outcome language includes delayed closure, escalation, unresolved loop, lost to follow-up, and clinical consequence proxy.

## Notes

- Keep the service-role key server-side only.
- Do not enter patient identifiers in the survey.
- The admin export route requires `ADMIN_EXPORT_PASSWORD`.
