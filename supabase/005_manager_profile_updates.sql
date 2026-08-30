-- Policy Hub — let managers change other staff members' roles
-- Run this in the Supabase SQL Editor, in the Policy Hub project.

create policy "Managers can update any profile"
  on profiles for update
  to authenticated
  using (
    exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.role = 'manager')
  );
