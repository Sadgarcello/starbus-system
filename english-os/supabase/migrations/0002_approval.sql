-- ============================================================================
-- 0002_approval.sql
-- Self-registration with admin approval (pending → active | rejected).
-- Run after 0001_init.sql in Supabase SQL Editor.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type account_status as enum ('pending', 'active', 'rejected');
  end if;
end$$;

alter table public.profiles
  add column if not exists status account_status not null default 'pending';

alter table public.profiles
  add column if not exists requested_role user_role not null default 'student';

-- Existing accounts become active (club already running)
update public.profiles set status = 'active' where status = 'pending';

-- Helpers require active status ------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'teacher')
      and status = 'active'
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- Signup: first user = active admin; everyone else = pending ----------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role user_role;
  req_role user_role;
  chosen_status account_status;
  display_name text;
  pre_approved boolean;
begin
  display_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  req_role := coalesce((new.raw_user_meta_data->>'requested_role')::user_role, 'student');
  if req_role = 'admin' then
    req_role := 'student'; -- never self-request admin
  end if;

  chosen_role := coalesce((new.raw_user_meta_data->>'role')::user_role, req_role);
  if chosen_role = 'admin' then
    chosen_role := 'student';
  end if;

  pre_approved := coalesce((new.raw_user_meta_data->>'pre_approved')::boolean, false);
  chosen_status := case when pre_approved then 'active'::account_status else 'pending'::account_status end;

  -- First user becomes active admin
  if not exists (select 1 from public.profiles) then
    chosen_role := 'admin';
    req_role := 'admin';
    chosen_status := 'active';
  end if;

  insert into public.profiles (id, email, name, role, status, requested_role)
  values (new.id, new.email, display_name, chosen_role, chosen_status, req_role);

  -- Only create student row when already active student (e.g. teacher invite)
  if chosen_status = 'active' and chosen_role = 'student' then
    insert into public.students (user_id, level, teacher_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'level', 'A1'),
      nullif(new.raw_user_meta_data->>'teacher_id', '')::uuid
    );
  end if;

  return new;
end;
$$;

-- Non-admins cannot change role/status ----------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if old.id is distinct from auth.uid() then
    raise exception 'insufficient_privilege';
  end if;

  new.role := old.role;
  new.status := old.status;
  new.requested_role := old.requested_role;
  new.email := old.email;
  new.id := old.id;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_update on public.profiles;
create trigger trg_guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Approve helper (creates student row when needed) ----------------------------
create or replace function public.approve_member(target_id uuid, grant_role user_role default 'student')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'insufficient_privilege';
  end if;

  if grant_role = 'admin' then
    raise exception 'cannot_grant_admin_via_approve';
  end if;

  update public.profiles
  set status = 'active',
      role = grant_role
  where id = target_id;

  if grant_role = 'student' and not exists (
    select 1 from public.students where user_id = target_id
  ) then
    insert into public.students (user_id, level)
    values (target_id, 'A1');
  end if;
end;
$$;

create or replace function public.reject_member(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'insufficient_privilege';
  end if;

  update public.profiles
  set status = 'rejected'
  where id = target_id;
end;
$$;

grant execute on function public.approve_member(uuid, user_role) to authenticated;
grant execute on function public.reject_member(uuid) to authenticated;
