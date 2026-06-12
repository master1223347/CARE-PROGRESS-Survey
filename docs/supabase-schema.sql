create extension if not exists "pgcrypto";

create table if not exists respondents (
  respondent_id uuid primary key,
  submission_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  record_use_basis text not null,
  confirm_no_identifiers boolean not null,
  confirm_research_only boolean not null,
  respondent_role text not null,
  specialty text not null,
  practice_setting text not null,
  opd_volume text not null,
  support_staff text[] not null,
  record_system text not null,
  lab_tracking text not null,
  referral_tracking text not null,
  followup_tracking text not null,
  communication_channel text not null,
  digital_maturity integer not null check (digital_maturity between 1 and 5)
);

create table if not exists care_loops (
  loop_id uuid primary key,
  respondent_id uuid not null references respondents(respondent_id) on delete cascade,
  loop_number integer not null check (loop_number between 1 and 10),
  loop_code text not null,
  loop_family text not null,
  loop_type text not null,
  loop_specialty text not null,
  test_category text,
  referral_category text,
  urgency text not null,
  severity text not null,
  recommended_window text not null,
  delay_affect_care text not null,
  created_at timestamptz not null default now(),
  unique (respondent_id, loop_number),
  unique (respondent_id, loop_code)
);

create table if not exists event_timeline (
  loop_id uuid primary key references care_loops(loop_id) on delete cascade,
  review_status text not null,
  review_day_offset integer,
  contact_status text not null,
  contact_day_offset integer,
  action_status text not null,
  action_day_offset integer,
  followup_scheduled_status text not null,
  followup_scheduled_day_offset integer,
  closure_status text not null,
  closure_day_offset integer,
  audit_age_days_if_open integer,
  check (review_day_offset is null or review_day_offset >= 0),
  check (contact_day_offset is null or contact_day_offset >= 0),
  check (action_day_offset is null or action_day_offset >= 0),
  check (followup_scheduled_day_offset is null or followup_scheduled_day_offset >= 0),
  check (closure_day_offset is null or closure_day_offset >= 0),
  check (audit_age_days_if_open is null or audit_age_days_if_open >= 0)
);

create table if not exists workflow_path (
  loop_id uuid primary key references care_loops(loop_id) on delete cascade,
  first_receiver_role text not null,
  reviewer_role text not null,
  contact_role text not null,
  owner_role text not null,
  closer_role text not null,
  handoff_count text not null,
  tracking_method text not null,
  support_staff_involved text not null,
  loop_communication_channel text not null,
  clinic_load text
);

create table if not exists resolution_outcomes (
  loop_id uuid primary key references care_loops(loop_id) on delete cascade,
  current_status text not null,
  patient_contacted text not null,
  followup_completed text not null,
  escalation_required text not null,
  emergency_referral_or_admission text not null,
  care_plan_changed text not null
);

create table if not exists evidence_quality (
  loop_id uuid primary key references care_loops(loop_id) on delete cascade,
  evidence_source text not null,
  confidence text not null,
  selection_method text not null,
  verification_willingness text,
  record_use_basis text not null
);

create table if not exists site_operations (
  respondent_id uuid primary key references respondents(respondent_id) on delete cascade,
  abnormal_result_owner_exists text not null,
  referral_owner_exists text not null,
  unresolved_review_cadence text not null,
  future_export_available text not null,
  future_approval_path text not null
);

alter table respondents enable row level security;
alter table care_loops enable row level security;
alter table event_timeline enable row level security;
alter table workflow_path enable row level security;
alter table resolution_outcomes enable row level security;
alter table evidence_quality enable row level security;
alter table site_operations enable row level security;

-- No anonymous policies are defined. The app writes and exports through server-only Supabase service-role calls.
