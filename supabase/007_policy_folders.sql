-- Policy Hub — folders for Policies & SOPs
-- Run this in the Supabase SQL Editor, in the Policy Hub project.
-- A document's folder is its existing documents.category text; this table is
-- the list of folders managers can add to, rename and remove.

create table policy_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

alter table policy_folders enable row level security;

create policy "Staff can read policy folders"
  on policy_folders for select
  to authenticated
  using (true);

create policy "Managers can add policy folders"
  on policy_folders for insert
  to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Managers can rename policy folders"
  on policy_folders for update
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Managers can remove policy folders"
  on policy_folders for delete
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

-- Start with the categories the app used before folders existed
insert into policy_folders (name) values
  ('Clinical'), ('HR'), ('Health & Safety'), ('Information Governance'),
  ('Safeguarding'), ('Complaints'), ('Other')
on conflict (name) do nothing;

-- Rename a folder and move its documents with it in one step.
-- Runs as the caller, so the manager-only policies above still apply.
create function rename_policy_folder(old_name text, new_name text)
returns void as $$
begin
  update policy_folders set name = new_name where name = old_name;
  if not found then
    raise exception 'Folder not found or you are not a manager';
  end if;
  update documents set category = new_name where category = old_name;
end;
$$ language plpgsql security invoker set search_path = public;
