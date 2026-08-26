-- Policy Hub — audits (separate from policies/SOPs)
-- Run this in the Supabase SQL Editor, in the Policy Hub project.

create table audits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audit_type text not null,
  owner text not null,
  audit_date date,
  reaudit_date date,
  storage_path text not null,
  cqc_standard text check (cqc_standard in ('Safe', 'Effective', 'Caring', 'Responsive', 'Well-led') or cqc_standard is null),
  content text,
  ai_review jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audits_audit_type_idx on audits (audit_type);
create index audits_reaudit_date_idx on audits (reaudit_date);

alter table audits enable row level security;

create policy "Staff can read all audits"
  on audits for select
  to authenticated
  using (true);

create policy "Managers can insert audits"
  on audits for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

create policy "Managers can update audits"
  on audits for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

create policy "Managers can delete audits"
  on audits for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

create trigger audits_set_updated_at
  before update on audits
  for each row execute function set_updated_at();

insert into storage.buckets (id, name, public)
values ('audits', 'audits', false)
on conflict (id) do nothing;

create policy "Staff can read audit files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'audits');

create policy "Managers can upload audit files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'audits'
    and exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

create policy "Managers can delete audit files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'audits'
    and exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );
