-- Policy Hub — what CQC inspectors have picked up on at other GP practices
-- Run this in the Supabase SQL Editor, in the Policy Hub project, after 009.
-- A manager presses "Update from CQC" on the CQC Standards page. The app lists recent
-- GP practice inspection reports through CQC's public API (needs CQC_API_KEY on Vercel),
-- the AI reads each report once and records its findings here, then summarises the
-- findings that keep coming up for each policy area. The CQC check and the policy chat
-- use those summaries.

-- One row per published inspection report
create table cqc_reports (
  link_id text primary key,              -- CQC's id for the report
  location_id text not null,
  location_name text not null,
  region text,
  report_date date not null,
  rating text,                            -- the practice's overall rating at the time it was read
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  findings jsonb not null default '[]',   -- [{ "type": "must" | "should" | "shortcoming", "area": "...", "text": "..." }]
  error text,
  added_at timestamptz not null default now(),
  read_at timestamptz
);

create index cqc_reports_status_idx on cqc_reports (status);

-- The recurring findings for each policy area, summarised across all the reports read
create table cqc_report_themes (
  area text primary key,                  -- a policy area from lib/practiceAreas.ts, or 'Other'
  themes jsonb not null default '[]',     -- [{ "type": "must" | "should", "text": "...", "reports": 12 }]
  report_count integer not null default 0, -- reports with at least one finding in this area
  updated_at timestamptz not null default now()
);

alter table cqc_reports enable row level security;
alter table cqc_report_themes enable row level security;

create policy "Staff can read CQC reports"
  on cqc_reports for select to authenticated using (true);

create policy "Managers can add CQC reports"
  on cqc_reports for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Managers can update CQC reports"
  on cqc_reports for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Staff can read CQC report themes"
  on cqc_report_themes for select to authenticated using (true);

create policy "Managers can add CQC report themes"
  on cqc_report_themes for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Managers can update CQC report themes"
  on cqc_report_themes for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));
