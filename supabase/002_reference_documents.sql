-- Policy Hub — reference documents (e.g. a CQC checklist you've produced)
-- Run this in the Supabase SQL Editor, in the Policy Hub project.

create table reference_documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null,
  content text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table reference_documents enable row level security;

create policy "Staff can read reference documents"
  on reference_documents for select
  to authenticated
  using (true);

create policy "Managers can insert reference documents"
  on reference_documents for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

create policy "Managers can delete reference documents"
  on reference_documents for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

insert into storage.buckets (id, name, public)
values ('reference-documents', 'reference-documents', false)
on conflict (id) do nothing;

create policy "Staff can read reference document files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'reference-documents');

create policy "Managers can upload reference document files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reference-documents'
    and exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

create policy "Managers can delete reference document files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'reference-documents'
    and exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );
