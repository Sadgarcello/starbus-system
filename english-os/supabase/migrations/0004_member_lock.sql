-- ============================================================================
-- 0004_member_lock.sql
-- Admin can lock a student out of the app until unlocked.
-- Run after 0001–0003 in Khawaja Club DB SQL Editor.
-- ============================================================================

alter table public.profiles
  add column if not exists is_locked boolean not null default false;

-- Non-admins cannot flip is_locked ------------------------------------------------
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
  new.is_locked := old.is_locked;
  return new;
end;
$$;

-- Active membership excludes locked accounts --------------------------------------
create or replace function public.is_active_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'active'
      and coalesce(is_locked, false) = false
  );
$$;

create or replace function public.set_member_locked(target_id uuid, locked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role user_role;
begin
  if not public.is_admin() then
    raise exception 'insufficient_privilege';
  end if;

  if target_id = auth.uid() then
    raise exception 'cannot_lock_self';
  end if;

  select role into target_role from public.profiles where id = target_id;
  if target_role is null then
    raise exception 'member_not_found';
  end if;

  if target_role = 'admin' then
    raise exception 'cannot_lock_admin';
  end if;

  update public.profiles
  set is_locked = locked
  where id = target_id;
end;
$$;

grant execute on function public.set_member_locked(uuid, boolean) to authenticated;
