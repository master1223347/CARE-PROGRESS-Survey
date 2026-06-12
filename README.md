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

## Notes

- Keep the service-role key server-side only.
- Do not enter patient identifiers in the survey.
- The admin export route requires `ADMIN_EXPORT_PASSWORD`.
