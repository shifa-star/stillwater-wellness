-- Journey member progress for the Supabase test project.
-- Idempotent enough to re-run in the SQL editor: tables are created only if
-- missing, policies are replaced, and grants are restated.
-- Email is stored lower-case text (citext's schema differs across projects).
-- The browser may read and write only its own progress, and only with an
-- active enrollment. It cannot create or edit enrollments.
-- Do not put a secret API key or database password in the site.

create table if not exists public.enrollments (
  email text primary key,
  user_id uuid references auth.users (id) on delete set null,
  program text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint enrollments_email_lowercase check (email = lower(email) and length(email) > 3)
);

create table if not exists public.journey_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  completed boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint journey_progress_key_length check (char_length(key) between 1 and 200),
  constraint journey_progress_notes_length check (notes is null or char_length(notes) <= 8000)
);

create index if not exists enrollments_user_id_idx on public.enrollments (user_id);
create index if not exists journey_progress_user_id_idx on public.journey_progress (user_id);

create or replace function public.is_enrolled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments
    where user_id = auth.uid()
      and active is true
  );
$$;

create or replace function public.journey_progress_force_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  new.user_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists journey_progress_force_owner on public.journey_progress;
create trigger journey_progress_force_owner
  before insert or update on public.journey_progress
  for each row execute function public.journey_progress_force_owner();

alter table public.enrollments enable row level security;
alter table public.journey_progress enable row level security;

revoke all on table public.enrollments from public, anon, authenticated;
revoke all on table public.journey_progress from public, anon, authenticated;
grant select on table public.enrollments to authenticated;
grant select, insert, update, delete on table public.journey_progress to authenticated;

revoke all on function public.is_enrolled() from public, anon, authenticated;
grant execute on function public.is_enrolled() to authenticated;
revoke all on function public.journey_progress_force_owner() from public, anon, authenticated;

drop policy if exists enrollments_select_own on public.enrollments;
create policy enrollments_select_own
  on public.enrollments
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists journey_progress_select_own on public.journey_progress;
create policy journey_progress_select_own
  on public.journey_progress
  for select
  to authenticated
  using (user_id = (select auth.uid()) and public.is_enrolled());

drop policy if exists journey_progress_insert_own on public.journey_progress;
create policy journey_progress_insert_own
  on public.journey_progress
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.is_enrolled());

drop policy if exists journey_progress_update_own on public.journey_progress;
create policy journey_progress_update_own
  on public.journey_progress
  for update
  to authenticated
  using (user_id = (select auth.uid()) and public.is_enrolled())
  with check (user_id = (select auth.uid()) and public.is_enrolled());

drop policy if exists journey_progress_delete_own on public.journey_progress;
create policy journey_progress_delete_own
  on public.journey_progress
  for delete
  to authenticated
  using (user_id = (select auth.uid()) and public.is_enrolled());
