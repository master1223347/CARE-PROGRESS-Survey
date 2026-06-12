# CARE-PROGRESS India Survey

Secure, mobile-first data-collection website for the CARE-PROGRESS India research pilot. The app collects de-identified respondent/site context plus 6 required outpatient care-loop audits, with optional loops up to 10 total.

## Concise Implementation Plan

1. Build a single-purpose Next.js App Router survey instrument, not a marketing site.
2. Store draft progress locally in the browser so respondents can move through consent, context, loops, operations, and review without a large single form.
3. Validate all submission payloads with Zod on the client and again on the server.
4. Write normalized Supabase rows through server-only API routes using the service-role key.
5. Protect CSV exports with `ADMIN_EXPORT_PASSWORD`.
6. Export logical CSVs plus a wide care-loop CSV with derived variables.

## Database Schema

The Supabase SQL schema is in [docs/supabase-schema.sql](docs/supabase-schema.sql). It creates:

- `respondents`
- `care_loops`
- `event_timeline`
- `workflow_path`
- `resolution_outcomes`
- `evidence_quality`
- `site_operations`

RLS is enabled and no anonymous policies are defined. The browser never receives the Supabase service-role key.

## Form/Page Structure

- `/`: full respondent flow
- `/admin`: protected CSV export UI
- `/api/submissions`: validated submission write endpoint with basic IP rate limiting
- `/api/admin/export/[file]`: protected CSV export endpoint

Survey flow:

1. Intro/study explanation
2. Consent and de-identification gate
3. Respondent/site context
4. Care-loop dashboard with 6 required loops
5. Reusable loop form for Loop 1 through Loop 10
6. Operational readiness/future verification
7. Review and final no-identifiers checkbox
8. Thank-you page

## Validation Schema

Validation lives in [src/lib/schemas.ts](src/lib/schemas.ts). It enforces:

- Consent checkboxes before continuing
- Required respondent/site context
- 6 required loops before final submission, optional loops up to 10
- Required loop family, type, specialty, urgency, severity, recommended window, closure status, evidence source, confidence, and selection method
- Conditional `test_category` for abnormal diagnostic result loops
- Conditional `referral_category` for referral/follow-up loops
- Non-negative integer day offsets
- Required offsets for known review/contact/action/follow-up/closure events
- Required audit age for still-open loops
- Closure day cannot be earlier than known review/action days
- `L001`-style loop codes only, with identifier-risk pattern checks
- Final confirmation that no identifiable patient information was entered

Derived export variables live in [src/lib/derived.ts](src/lib/derived.ts): `days_to_review`, `days_to_contact`, `days_to_action`, `days_to_followup_scheduled`, `days_to_closure`, `censored_status`, `censored_time`, `recommended_window_days`, `days_overdue`, `positive_days_overdue`, `urgency_weight`, `risk_weighted_delay`, and `stall_stage`.

## File Tree

```text
src/app/page.tsx
src/app/admin/page.tsx
src/app/api/submissions/route.ts
src/app/api/admin/export/[file]/route.ts
src/components/survey-app.tsx
src/components/admin-export.tsx
src/lib/options.ts
src/lib/schemas.ts
src/lib/derived.ts
src/lib/privacy.ts
src/lib/supabase.ts
docs/supabase-schema.sql
.env.example
```

## Environment Variables

Copy `.env.example` to `.env.local` and set:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-server-only-service-role-key
ADMIN_EXPORT_PASSWORD=replace-with-a-long-random-password
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client code or `NEXT_PUBLIC_*` variables.

## Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run [docs/supabase-schema.sql](docs/supabase-schema.sql).
4. Create `.env.local` from `.env.example`.
5. Install dependencies:

```bash
npm install
```

## Local Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deployment

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_EXPORT_PASSWORD` in Vercel project environment variables.
4. Deploy.
5. Confirm the deployed app uses HTTPS and that `/admin` rejects exports without the password.

## Testing Checklist Using Fake Data

- Try to proceed without both consent checkboxes: should block.
- Complete respondent context with fake role/site values.
- Complete 6 fake loop audits using loop codes `L001` through `L006`.
- Confirm abnormal-result loops show `test_category`.
- Confirm referral/follow-up loops show `referral_category`.
- Enter `closure_day_offset = -5`: should block.
- Set `review_status = Reviewed` with blank `review_day_offset`: should block.
- Set `closure_day_offset` earlier than review/action day: should block.
- Enter a phone-like loop code: should block.
- Leave evidence source or confidence blank through direct payload manipulation: server should reject.
- Try final submission with only 5 complete loops: should block.
- Confirm no file upload, patient name, MRN, address, exact date, or clinical note fields exist.

## CSV Export Verification

1. Submit one fake complete respondent with 6 loops.
2. Go to `/admin`.
3. Enter `ADMIN_EXPORT_PASSWORD`.
4. Download:
   - `respondents.csv`
   - `care_loops.csv`
   - `event_timeline.csv`
   - `workflow_path.csv`
   - `resolution_outcomes.csv`
   - `evidence_quality.csv`
   - `site_operations.csv`
5. Confirm `respondents.csv` has one respondent row.
6. Confirm `care_loops.csv` has six loop rows and includes derived variables.
7. Confirm split CSVs can be joined by `respondent_id` or `loop_id`.
