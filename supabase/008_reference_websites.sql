-- Policy Hub — reference websites for the AI CQC check
-- Run this in the Supabase SQL Editor, in the Policy Hub project.
-- Managers add web pages (e.g. CQC or NHS England guidance). The app saves the
-- page's text when it's added or refreshed, and the CQC check reads that text.

create table reference_websites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  url text not null check (url ~* '^https?://'),
  content text,
  fetched_at timestamptz,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table reference_websites enable row level security;

create policy "Staff can read reference websites"
  on reference_websites for select
  to authenticated
  using (true);

create policy "Managers can add reference websites"
  on reference_websites for insert
  to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Managers can refresh reference websites"
  on reference_websites for update
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Managers can remove reference websites"
  on reference_websites for delete
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));
