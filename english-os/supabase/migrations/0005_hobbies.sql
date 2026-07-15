-- ============================================================================
-- 0005_hobbies.sql
-- Student interests → admin-normalized universal hobbies.
-- Run after 0001–0004 in Khawaja Club DB SQL Editor.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'hobby_suggestion_status') then
    create type hobby_suggestion_status as enum ('pending', 'approved', 'rejected');
  end if;
end$$;

create table if not exists public.hobbies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.hobby_aliases (
  id          uuid primary key default gen_random_uuid(),
  hobby_id    uuid not null references public.hobbies (id) on delete cascade,
  alias       text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.hobby_suggestions (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.students (id) on delete cascade,
  raw_text            text not null,
  status              hobby_suggestion_status not null default 'pending',
  resolved_hobby_id   uuid references public.hobbies (id) on delete set null,
  reviewed_by         uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  reviewed_at         timestamptz
);

create index if not exists idx_hobby_suggestions_status
  on public.hobby_suggestions (status, created_at);

create table if not exists public.student_hobbies (
  student_id  uuid not null references public.students (id) on delete cascade,
  hobby_id    uuid not null references public.hobbies (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (student_id, hobby_id)
);

create or replace function public.slugify_hobby(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(input)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.find_hobby_id_by_label(label text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select h.id
  from public.hobbies h
  where lower(h.name) = lower(trim(label))
     or exists (
       select 1 from public.hobby_aliases a
       where a.hobby_id = h.id and lower(a.alias) = lower(trim(label))
     )
  limit 1;
$$;

-- Student: add existing hobby or create a pending suggestion --------------------
create or replace function public.request_or_add_hobby(raw_interest text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid := public.my_student_id();
  cleaned text := trim(raw_interest);
  hid uuid;
begin
  if sid is null then
    raise exception 'student_profile_required';
  end if;

  if cleaned is null or length(cleaned) < 2 then
    raise exception 'interest_too_short';
  end if;

  if length(cleaned) > 60 then
    raise exception 'interest_too_long';
  end if;

  hid := public.find_hobby_id_by_label(cleaned);

  if hid is not null then
    insert into public.student_hobbies (student_id, hobby_id)
    values (sid, hid)
    on conflict do nothing;

    return jsonb_build_object('status', 'added', 'hobby_id', hid);
  end if;

  -- Avoid duplicate pending suggestions from the same student
  if exists (
    select 1 from public.hobby_suggestions
    where student_id = sid
      and status = 'pending'
      and lower(raw_text) = lower(cleaned)
  ) then
    return jsonb_build_object('status', 'pending_exists');
  end if;

  insert into public.hobby_suggestions (student_id, raw_text)
  values (sid, cleaned);

  return jsonb_build_object('status', 'pending');
end;
$$;

-- Admin: normalize suggestion into a universal hobby --------------------------
create or replace function public.normalize_hobby_suggestion(
  suggestion_id uuid,
  canonical_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sug public.hobby_suggestions%rowtype;
  cleaned text := trim(canonical_name);
  hid uuid;
  v_slug text;
begin
  if not public.is_admin() then
    raise exception 'insufficient_privilege';
  end if;

  if cleaned is null or length(cleaned) < 2 then
    raise exception 'hobby_name_required';
  end if;

  select * into sug from public.hobby_suggestions where id = suggestion_id;
  if sug.id is null then
    raise exception 'suggestion_not_found';
  end if;

  if sug.status <> 'pending' then
    raise exception 'suggestion_not_pending';
  end if;

  hid := public.find_hobby_id_by_label(cleaned);
  if hid is null then
    v_slug := public.slugify_hobby(cleaned);
    if v_slug = '' then
      raise exception 'invalid_hobby_name';
    end if;

    insert into public.hobbies (name, slug)
    values (cleaned, v_slug)
    on conflict (slug) do update set name = excluded.name
    returning id into hid;

    if hid is null then
      select id into hid from public.hobbies where slug = v_slug;
    end if;
  end if;

  -- Keep the student's raw wording as an alias (e.g. soccer → Football)
  insert into public.hobby_aliases (hobby_id, alias)
  values (hid, lower(trim(sug.raw_text)))
  on conflict (alias) do update set hobby_id = excluded.hobby_id;

  if lower(trim(cleaned)) <> lower(trim(sug.raw_text)) then
    insert into public.hobby_aliases (hobby_id, alias)
    values (hid, lower(trim(cleaned)))
    on conflict (alias) do nothing;
  end if;

  insert into public.student_hobbies (student_id, hobby_id)
  values (sug.student_id, hid)
  on conflict do nothing;

  update public.hobby_suggestions
  set status = 'approved',
      resolved_hobby_id = hid,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = suggestion_id;

  return hid;
end;
$$;

create or replace function public.reject_hobby_suggestion(suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'insufficient_privilege';
  end if;

  update public.hobby_suggestions
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = suggestion_id and status = 'pending';
end;
$$;

grant execute on function public.request_or_add_hobby(text) to authenticated;
grant execute on function public.normalize_hobby_suggestion(uuid, text) to authenticated;
grant execute on function public.reject_hobby_suggestion(uuid) to authenticated;
grant execute on function public.find_hobby_id_by_label(text) to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.hobbies enable row level security;
alter table public.hobby_aliases enable row level security;
alter table public.hobby_suggestions enable row level security;
alter table public.student_hobbies enable row level security;

drop policy if exists "hobbies_select" on public.hobbies;
create policy "hobbies_select" on public.hobbies
  for select to authenticated
  using (true);

drop policy if exists "hobbies_write_admin" on public.hobbies;
create policy "hobbies_write_admin" on public.hobbies
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "hobby_aliases_select" on public.hobby_aliases;
create policy "hobby_aliases_select" on public.hobby_aliases
  for select to authenticated
  using (true);

drop policy if exists "hobby_aliases_write_admin" on public.hobby_aliases;
create policy "hobby_aliases_write_admin" on public.hobby_aliases
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "hobby_suggestions_select" on public.hobby_suggestions;
create policy "hobby_suggestions_select" on public.hobby_suggestions
  for select to authenticated
  using (
    public.is_admin()
    or student_id = public.my_student_id()
  );

drop policy if exists "hobby_suggestions_insert_student" on public.hobby_suggestions;
create policy "hobby_suggestions_insert_student" on public.hobby_suggestions
  for insert to authenticated
  with check (student_id = public.my_student_id());

drop policy if exists "hobby_suggestions_admin" on public.hobby_suggestions;
create policy "hobby_suggestions_admin" on public.hobby_suggestions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "student_hobbies_select" on public.student_hobbies;
create policy "student_hobbies_select" on public.student_hobbies
  for select to authenticated
  using (
    public.is_teacher()
    or student_id = public.my_student_id()
  );

drop policy if exists "student_hobbies_insert_own" on public.student_hobbies;
create policy "student_hobbies_insert_own" on public.student_hobbies
  for insert to authenticated
  with check (student_id = public.my_student_id());

drop policy if exists "student_hobbies_delete_own" on public.student_hobbies;
create policy "student_hobbies_delete_own" on public.student_hobbies
  for delete to authenticated
  using (
    student_id = public.my_student_id()
    or public.is_admin()
  );

-- Table privileges (RLS still applies) ----------------------------------------
grant select, insert, update, delete on table public.hobbies to authenticated;
grant select, insert, update, delete on table public.hobby_aliases to authenticated;
grant select, insert, update, delete on table public.hobby_suggestions to authenticated;
grant select, insert, update, delete on table public.student_hobbies to authenticated;
