-- Policy Hub — initial schema
-- Run this in the Supabase SQL Editor (Database > SQL Editor > New query)

-- ── profiles ─────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'staff' check (role in ('staff', 'manager')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read all profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── documents ────────────────────────────────────────────────────────────
create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  owner text not null,
  review_date date,
  storage_path text not null,
  cqc_standard text check (cqc_standard in ('Safe', 'Effective', 'Caring', 'Responsive', 'Well-led') or cqc_standard is null),
  content text,
  ai_review jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_category_idx on documents (category);
create index documents_review_date_idx on documents (review_date);

alter table documents enable row level security;

-- All authenticated staff can read/search every policy
create policy "Staff can read all documents"
  on documents for select
  to authenticated
  using (true);

-- Only managers can upload, edit, or delete
create policy "Managers can insert documents"
  on documents for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

create policy "Managers can update documents"
  on documents for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

create policy "Managers can delete documents"
  on documents for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

-- Keep updated_at current
create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger documents_set_updated_at
  before update on documents
  for each row execute function set_updated_at();

-- ── storage ──────────────────────────────────────────────────────────────
-- Run this after creating the bucket named "policies" (private) in
-- Storage > New bucket in the dashboard.

insert into storage.buckets (id, name, public)
values ('policies', 'policies', false)
on conflict (id) do nothing;

create policy "Staff can read policy files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'policies');

create policy "Managers can upload policy files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'policies'
    and exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

create policy "Managers can delete policy files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'policies'
    and exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

-- ── after running this ──────────────────────────────────────────────────
-- 1. Sign up your first user in the app (they'll default to role='staff').
-- 2. Promote yourself to manager so you can upload policies:
--    update profiles set role = 'manager' where id =
--      (select id from auth.users where email = 'you@example.com');
