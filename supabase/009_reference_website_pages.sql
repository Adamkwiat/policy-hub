-- Policy Hub — pages linked from a reference website
-- Run this in the Supabase SQL Editor, in the Policy Hub project, after 008.
-- When a reference website is an index (e.g. CQC GP mythbusters), the app reads
-- every page it lists and saves each one here. The CQC check picks the pages
-- most relevant to the policy being checked.

create table reference_website_pages (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references reference_websites(id) on delete cascade,
  title text not null,
  url text not null,
  content text,
  fetched_at timestamptz not null default now(),
  unique (website_id, url)
);

create index reference_website_pages_website_idx on reference_website_pages (website_id);

alter table reference_website_pages enable row level security;

create policy "Staff can read reference website pages"
  on reference_website_pages for select
  to authenticated
  using (true);

create policy "Managers can add reference website pages"
  on reference_website_pages for insert
  to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Managers can update reference website pages"
  on reference_website_pages for update
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Managers can remove reference website pages"
  on reference_website_pages for delete
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));
