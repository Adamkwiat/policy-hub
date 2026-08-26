-- Policy Hub — audit log
-- Run this in the Supabase SQL Editor, in the Policy Hub project.

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text not null,
  action text not null,
  resource_type text not null,
  resource_name text,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;

-- Any signed-in user can log their own actions
create policy "Authenticated users can insert audit entries"
  on audit_logs for insert
  to authenticated
  with check (true);

-- Only managers can read the audit trail
create policy "Managers can read audit logs"
  on audit_logs for select
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );
