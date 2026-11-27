-- Sanctuary client portal. Run in the Supabase SQL editor. Do not put a
-- service role key or a database password in the site or in this file.
-- The browser uses the publishable anon key. Row security decides every read.
-- Re-runnable: policies and functions are replaced.

create table if not exists public.portal_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'client',
  created_at timestamptz not null default now(),
  constraint portal_profiles_email_lower check (email = lower(email) and length(email) > 3),
  constraint portal_profiles_role check (role in ('client', 'admin')),
  constraint portal_profiles_name_len check (display_name is null or char_length(display_name) <= 80)
);

create table if not exists public.portal_editions (
  id uuid primary key default gen_random_uuid(),
  client_email text not null unique,
  client_user_id uuid references auth.users (id) on delete set null,
  display_name text,
  created_at timestamptz not null default now(),
  constraint portal_editions_email_lower check (client_email = lower(client_email) and length(client_email) > 3),
  constraint portal_editions_name_len check (display_name is null or char_length(display_name) <= 80)
);

create table if not exists public.portal_scans (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.portal_editions (id) on delete cascade,
  scanned_on date not null,
  title text,
  categories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint portal_scans_title_len check (title is null or char_length(title) <= 160)
);

create table if not exists public.portal_readings (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.portal_editions (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint portal_readings_len check (char_length(title) between 1 and 160 and char_length(body) <= 8000)
);

create table if not exists public.portal_summaries (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.portal_editions (id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint portal_summaries_status check (status in ('draft', 'approved', 'rejected')),
  constraint portal_summaries_len check (char_length(title) between 1 and 160 and char_length(body) <= 8000)
);

create table if not exists public.portal_letters (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.portal_editions (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint portal_letters_len check (char_length(body) between 1 and 8000)
);

create table if not exists public.portal_sleep_logs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.portal_editions (id) on delete cascade,
  logged_on date not null default (now() at time zone 'Pacific/Honolulu')::date,
  item text not null,
  response text not null,
  created_at timestamptz not null default now(),
  constraint portal_sleep_len check (char_length(item) between 1 and 160 and char_length(response) <= 4000)
);

create table if not exists public.portal_reminder_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_opt_in boolean not null default false,
  cadence text not null default 'off',
  created_at timestamptz not null default now(),
  constraint portal_reminder_cadence check (cadence in ('off', 'weekly'))
);

create table if not exists public.portal_intake_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null,
  edition_id uuid references public.portal_editions (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint portal_intake_kind check (kind in ('health_story', 'call_summary'))
);

create index if not exists portal_editions_user_idx on public.portal_editions (client_user_id);
create index if not exists portal_scans_edition_idx on public.portal_scans (edition_id, scanned_on);
create index if not exists portal_summaries_edition_idx on public.portal_summaries (edition_id, status);
create index if not exists portal_letters_edition_idx on public.portal_letters (edition_id);
create index if not exists portal_sleep_edition_idx on public.portal_sleep_logs (edition_id, logged_on);

create or replace function public.portal_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'shifa@shifaali-scott.com'
    or exists (
      select 1
      from public.portal_profiles
      where user_id = auth.uid()
        and role = 'admin'
    );
$$;

create or replace function public.portal_owns_edition(p_edition uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_editions
    where id = p_edition
      and client_user_id = auth.uid()
  );
$$;

create or replace function public.portal_claim_edition()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Sign in required';
  end if;
  update public.portal_editions
     set client_user_id = auth.uid()
   where client_user_id is null
     and client_email = v_email;
  insert into public.portal_profiles (user_id, email, display_name, role)
  select auth.uid(), v_email, e.display_name, 'client'
  from public.portal_editions e
  where e.client_email = v_email
    and e.client_user_id = auth.uid()
  on conflict (user_id) do update
    set email = excluded.email
  where public.portal_profiles.role is distinct from 'admin';
end;
$$;

create or replace function public.portal_admin_create_edition(p_email text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_id uuid;
begin
  if not public.portal_is_admin() then
    raise exception 'Admin only';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A real email is required';
  end if;
  insert into public.portal_editions (client_email, display_name)
  values (v_email, v_name)
  on conflict (client_email) do update
    set display_name = coalesce(excluded.display_name, public.portal_editions.display_name)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.portal_admin_set_summary(p_id uuid, p_action text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.portal_is_admin() then
    raise exception 'Admin only';
  end if;
  if p_action = 'approve' then
    update public.portal_summaries
       set status = 'approved', reviewed_at = now(),
           body = coalesce(nullif(btrim(coalesce(p_body, '')), ''), body)
     where id = p_id;
  elsif p_action = 'reject' then
    update public.portal_summaries
       set status = 'rejected', reviewed_at = now()
     where id = p_id;
  elsif p_action = 'edit' then
    if nullif(btrim(coalesce(p_body, '')), '') is null then
      raise exception 'Body required';
    end if;
    update public.portal_summaries
       set body = btrim(p_body)
     where id = p_id;
  else
    raise exception 'Unknown action';
  end if;
end;
$$;

create or replace function public.portal_admin_save_scan(
  p_edition uuid,
  p_scanned_on date,
  p_title text,
  p_categories jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.portal_is_admin() then
    raise exception 'Admin only';
  end if;
  if p_edition is null or p_scanned_on is null then
    raise exception 'Edition and date are required';
  end if;
  insert into public.portal_scans (edition_id, scanned_on, title, categories)
  values (p_edition, p_scanned_on, nullif(btrim(coalesce(p_title, '')), ''), coalesce(p_categories, '[]'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.portal_admin_save_reading(p_edition uuid, p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.portal_is_admin() then
    raise exception 'Admin only';
  end if;
  insert into public.portal_readings (edition_id, title, body)
  values (p_edition, btrim(p_title), btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.portal_record_intake(p_kind text, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_payload ->> 'email', '')));
  v_edition uuid;
  v_event uuid;
begin
  if p_kind not in ('health_story', 'call_summary') then
    raise exception 'Unknown intake kind';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email required';
  end if;
  insert into public.portal_editions (client_email, display_name)
  values (v_email, nullif(btrim(coalesce(p_payload ->> 'display_name', '')), ''))
  on conflict (client_email) do update
    set display_name = coalesce(excluded.display_name, public.portal_editions.display_name)
  returning id into v_edition;
  if p_kind = 'call_summary' then
    insert into public.portal_summaries (edition_id, title, body, status)
    values (
      v_edition,
      coalesce(nullif(btrim(coalesce(p_payload ->> 'title', '')), ''), 'Call notes'),
      coalesce(p_payload ->> 'body', ''),
      'draft'
    );
  end if;
  insert into public.portal_intake_events (kind, payload, edition_id)
  values (p_kind, p_payload, v_edition)
  returning id into v_event;
  return v_event;
end;
$$;

create or replace function public.portal_letters_force_author()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if not public.portal_owns_edition(new.edition_id) and not public.portal_is_admin() then
    raise exception 'Not your edition';
  end if;
  new.author_user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists portal_letters_force_author on public.portal_letters;
create trigger portal_letters_force_author
  before insert or update on public.portal_letters
  for each row execute function public.portal_letters_force_author();

alter table public.portal_profiles enable row level security;
alter table public.portal_editions enable row level security;
alter table public.portal_scans enable row level security;
alter table public.portal_readings enable row level security;
alter table public.portal_summaries enable row level security;
alter table public.portal_letters enable row level security;
alter table public.portal_sleep_logs enable row level security;
alter table public.portal_reminder_prefs enable row level security;
alter table public.portal_intake_events enable row level security;

revoke all on table public.portal_profiles from public, anon, authenticated;
revoke all on table public.portal_editions from public, anon, authenticated;
revoke all on table public.portal_scans from public, anon, authenticated;
revoke all on table public.portal_readings from public, anon, authenticated;
revoke all on table public.portal_summaries from public, anon, authenticated;
revoke all on table public.portal_letters from public, anon, authenticated;
revoke all on table public.portal_sleep_logs from public, anon, authenticated;
revoke all on table public.portal_reminder_prefs from public, anon, authenticated;
revoke all on table public.portal_intake_events from public, anon, authenticated;

grant select on table public.portal_profiles to authenticated;
grant select, update on table public.portal_editions to authenticated;
grant select on table public.portal_scans to authenticated;
grant select on table public.portal_readings to authenticated;
grant select on table public.portal_summaries to authenticated;
grant select, insert, update, delete on table public.portal_letters to authenticated;
grant select, insert on table public.portal_sleep_logs to authenticated;
grant select, insert, update on table public.portal_reminder_prefs to authenticated;
grant select on table public.portal_intake_events to authenticated;

revoke all on function public.portal_is_admin() from public, anon, authenticated;
revoke all on function public.portal_owns_edition(uuid) from public, anon, authenticated;
revoke all on function public.portal_claim_edition() from public, anon, authenticated;
revoke all on function public.portal_admin_create_edition(text, text) from public, anon, authenticated;
revoke all on function public.portal_admin_set_summary(uuid, text, text) from public, anon, authenticated;
revoke all on function public.portal_admin_save_scan(uuid, date, text, jsonb) from public, anon, authenticated;
revoke all on function public.portal_admin_save_reading(uuid, text, text) from public, anon, authenticated;
revoke all on function public.portal_record_intake(text, jsonb) from public, anon, authenticated;
revoke all on function public.portal_letters_force_author() from public, anon, authenticated;

grant execute on function public.portal_is_admin() to authenticated;
grant execute on function public.portal_owns_edition(uuid) to authenticated;
grant execute on function public.portal_claim_edition() to authenticated;
grant execute on function public.portal_admin_create_edition(text, text) to authenticated;
grant execute on function public.portal_admin_set_summary(uuid, text, text) to authenticated;
grant execute on function public.portal_admin_save_scan(uuid, date, text, jsonb) to authenticated;
grant execute on function public.portal_admin_save_reading(uuid, text, text) to authenticated;

drop policy if exists portal_profiles_select on public.portal_profiles;
create policy portal_profiles_select
  on public.portal_profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()) or public.portal_is_admin());

drop policy if exists portal_profiles_update_own on public.portal_profiles;
create policy portal_profiles_update_own
  on public.portal_profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and role = (select p.role from public.portal_profiles p where p.user_id = (select auth.uid())));

drop policy if exists portal_editions_select on public.portal_editions;
create policy portal_editions_select
  on public.portal_editions
  for select
  to authenticated
  using (client_user_id = (select auth.uid()) or public.portal_is_admin());

drop policy if exists portal_editions_update_name on public.portal_editions;
create policy portal_editions_update_name
  on public.portal_editions
  for update
  to authenticated
  using (client_user_id = (select auth.uid()) or public.portal_is_admin())
  with check (client_user_id = (select auth.uid()) or public.portal_is_admin());

drop policy if exists portal_scans_select on public.portal_scans;
create policy portal_scans_select
  on public.portal_scans
  for select
  to authenticated
  using (public.portal_owns_edition(edition_id) or public.portal_is_admin());

drop policy if exists portal_readings_select on public.portal_readings;
create policy portal_readings_select
  on public.portal_readings
  for select
  to authenticated
  using (public.portal_owns_edition(edition_id) or public.portal_is_admin());

drop policy if exists portal_summaries_select on public.portal_summaries;
create policy portal_summaries_select
  on public.portal_summaries
  for select
  to authenticated
  using (
    public.portal_is_admin()
    or (
      status = 'approved'
      and public.portal_owns_edition(edition_id)
    )
  );

drop policy if exists portal_letters_select on public.portal_letters;
create policy portal_letters_select
  on public.portal_letters
  for select
  to authenticated
  using (
    (author_user_id = (select auth.uid()) and public.portal_owns_edition(edition_id))
    or public.portal_is_admin()
  );

drop policy if exists portal_letters_insert on public.portal_letters;
create policy portal_letters_insert
  on public.portal_letters
  for insert
  to authenticated
  with check (author_user_id = (select auth.uid()) and public.portal_owns_edition(edition_id));

drop policy if exists portal_letters_update on public.portal_letters;
create policy portal_letters_update
  on public.portal_letters
  for update
  to authenticated
  using (author_user_id = (select auth.uid()) and public.portal_owns_edition(edition_id))
  with check (author_user_id = (select auth.uid()) and public.portal_owns_edition(edition_id));

drop policy if exists portal_letters_delete on public.portal_letters;
create policy portal_letters_delete
  on public.portal_letters
  for delete
  to authenticated
  using (author_user_id = (select auth.uid()) and public.portal_owns_edition(edition_id));

drop policy if exists portal_sleep_select on public.portal_sleep_logs;
create policy portal_sleep_select
  on public.portal_sleep_logs
  for select
  to authenticated
  using (public.portal_owns_edition(edition_id) or public.portal_is_admin());

drop policy if exists portal_sleep_insert on public.portal_sleep_logs;
create policy portal_sleep_insert
  on public.portal_sleep_logs
  for insert
  to authenticated
  with check (public.portal_owns_edition(edition_id));

drop policy if exists portal_reminder_all on public.portal_reminder_prefs;
create policy portal_reminder_all
  on public.portal_reminder_prefs
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists portal_intake_admin on public.portal_intake_events;
create policy portal_intake_admin
  on public.portal_intake_events
  for select
  to authenticated
  using (public.portal_is_admin());
