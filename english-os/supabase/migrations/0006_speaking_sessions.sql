-- ============================================================================
-- 0006_speaking_sessions.sql
-- Speaking formats catalog + day topic + +7% practice marks (15 → level up).
-- Run after 0001–0005 in Khawaja Club DB SQL Editor.
-- ============================================================================

alter table public.students
  add column if not exists speaking_progress integer not null default 0
    check (speaking_progress >= 0 and speaking_progress <= 100);

create table if not exists public.speaking_formats (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  details     text not null,
  goal        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.speaking_day_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_date  date not null unique,
  format_id     uuid not null references public.speaking_formats (id) on delete restrict,
  status        text not null default 'open' check (status in ('open', 'closed')),
  chosen_by     uuid references public.profiles (id) on delete set null,
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.speaking_practice_marks (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.speaking_day_sessions (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  marked_at    timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists idx_speaking_practice_student
  on public.speaking_practice_marks (student_id);

-- Seed suggestion formats -----------------------------------------------------
insert into public.speaking_formats (slug, title, details, goal, sort_order)
values
(
  'speed-speaking',
  'Speed Speaking (Conversation Roulette)',
  E'Students pair up.\nGive them a topic.\nThey speak for 2–3 minutes, then switch partners.\n\nTopics:\n• Describe your hometown\n• Your dream job\n• A difficult decision you made\n• If you had $1 million...',
  'Confidence + fluency.',
  1
),
(
  'debate-battles',
  'Debate Battles',
  E'Split students into two teams.\n\nExamples:\n• University is better than online learning.\n• Money can buy happiness.\n• AI will replace humans.\n• Students should not have homework.\n\nGive them 5 minutes to prepare, then debate.',
  'Thinking in English + expressing opinions.',
  2
)
on conflict (slug) do update set
  title = excluded.title,
  details = excluded.details,
  goal = excluded.goal,
  sort_order = excluded.sort_order;

create or replace function public.next_english_level(current_level text)
returns text
language plpgsql
immutable
as $$
declare
  lvl text := upper(trim(coalesce(current_level, 'A1')));
begin
  return case lvl
    when 'A1' then 'A2'
    when 'A2' then 'B1'
    when 'B1' then 'B2'
    when 'B2' then 'C1'
    when 'C1' then 'C2'
    else 'C2'
  end;
end;
$$;

-- Teacher/admin: open (or reopen) today's speaking topic -----------------------
create or replace function public.open_speaking_day(p_format_id uuid, p_session_date date default current_date)
returns public.speaking_day_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.speaking_day_sessions;
begin
  if not public.is_teacher() then
    raise exception 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.speaking_formats where id = p_format_id) then
    raise exception 'format_not_found';
  end if;

  insert into public.speaking_day_sessions (session_date, format_id, status, chosen_by, opened_at, closed_at)
  values (p_session_date, p_format_id, 'open', auth.uid(), now(), null)
  on conflict (session_date) do update
    set format_id = excluded.format_id,
        status = 'open',
        chosen_by = auth.uid(),
        opened_at = now(),
        closed_at = null
  returning * into row;

  return row;
end;
$$;

create or replace function public.close_speaking_day(p_session_id uuid)
returns public.speaking_day_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.speaking_day_sessions;
begin
  if not public.is_teacher() then
    raise exception 'insufficient_privilege';
  end if;

  update public.speaking_day_sessions
  set status = 'closed', closed_at = now()
  where id = p_session_id
  returning * into row;

  if row.id is null then
    raise exception 'session_not_found';
  end if;

  return row;
end;
$$;

-- Student marks practice: +7% speaking, level up at 100% (15 sessions) --------
create or replace function public.mark_speaking_practice(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid := public.my_student_id();
  sess public.speaking_day_sessions%rowtype;
  prog integer;
  new_prog integer;
  leveled boolean := false;
  new_level text;
begin
  if sid is null then
    raise exception 'student_profile_required';
  end if;

  select * into sess from public.speaking_day_sessions where id = p_session_id;
  if sess.id is null then
    raise exception 'session_not_found';
  end if;

  if sess.status <> 'open' then
    raise exception 'speaking_day_closed';
  end if;

  insert into public.speaking_practice_marks (session_id, student_id)
  values (p_session_id, sid);

  select speaking_progress, level into prog, new_level
  from public.students where id = sid;

  new_prog := least(100, coalesce(prog, 0) + 7);

  if new_prog >= 100 then
    leveled := true;
    new_level := public.next_english_level(new_level);
    update public.students
    set speaking_progress = 0,
        level = new_level
    where id = sid;
    new_prog := 0;
  else
    update public.students
    set speaking_progress = new_prog
    where id = sid;
  end if;

  return jsonb_build_object(
    'speaking_progress', new_prog,
    'leveled_up', leveled,
    'level', new_level,
    'sessions_toward_level', (new_prog / 7)
  );
exception
  when unique_violation then
    raise exception 'already_practiced_today';
end;
$$;

grant execute on function public.open_speaking_day(uuid, date) to authenticated;
grant execute on function public.close_speaking_day(uuid) to authenticated;
grant execute on function public.mark_speaking_practice(uuid) to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.speaking_formats enable row level security;
alter table public.speaking_day_sessions enable row level security;
alter table public.speaking_practice_marks enable row level security;

drop policy if exists "speaking_formats_select" on public.speaking_formats;
create policy "speaking_formats_select" on public.speaking_formats
  for select to authenticated using (true);

drop policy if exists "speaking_formats_admin" on public.speaking_formats;
drop policy if exists "speaking_formats_write_teacher" on public.speaking_formats;
create policy "speaking_formats_write_teacher" on public.speaking_formats
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "speaking_sessions_select" on public.speaking_day_sessions;
create policy "speaking_sessions_select" on public.speaking_day_sessions
  for select to authenticated using (true);

drop policy if exists "speaking_sessions_teacher" on public.speaking_day_sessions;
create policy "speaking_sessions_teacher" on public.speaking_day_sessions
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "speaking_marks_select" on public.speaking_practice_marks;
create policy "speaking_marks_select" on public.speaking_practice_marks
  for select to authenticated
  using (
    public.is_teacher()
    or student_id = public.my_student_id()
  );

drop policy if exists "speaking_marks_insert_own" on public.speaking_practice_marks;
create policy "speaking_marks_insert_own" on public.speaking_practice_marks
  for insert to authenticated
  with check (
    student_id = public.my_student_id()
    and exists (
      select 1 from public.speaking_day_sessions s
      where s.id = session_id and s.status = 'open'
    )
  );

grant select, insert, update, delete on table public.speaking_formats to authenticated;
grant select, insert, update, delete on table public.speaking_day_sessions to authenticated;
grant select, insert, update, delete on table public.speaking_practice_marks to authenticated;
