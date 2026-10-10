-- Policy Hub — only managers may set or change anyone's role
-- Run this in the Supabase SQL Editor, in the Policy Hub project.
-- Without it, the "Users can update their own profile" policy let any staff
-- member promote themselves to manager.

create or replace function protect_profile_role()
returns trigger as $$
begin
  -- No signed-in user: the signup trigger, service role or SQL Editor
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'staff'
      and not exists (select 1 from profiles where id = auth.uid() and role = 'manager') then
      raise exception 'Only managers can set staff roles';
    end if;
  elsif new.role is distinct from old.role
    and not exists (select 1 from profiles where id = auth.uid() and role = 'manager') then
    raise exception 'Only managers can change staff roles';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger profiles_protect_role
  before insert or update on profiles
  for each row execute function protect_profile_role();
