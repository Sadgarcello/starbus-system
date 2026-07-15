-- ============================================================================
-- 0003_attendance_avatars.sql
-- Day-gated attendance sessions + private avatar storage.
-- Run after 0001 + 0002 in Khawaja Club DB SQL Editor.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'attendance_session_status') then
    create type attendance_session_status as enum ('open', 'closed');
  end if;
end$$;

-- Attendance sessions (one row per calendar day) ------------------------------
create table if not exists public.attendance_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_date  date not null unique,
  status        attendance_session_status not null default 'closed',
  opened_by     uuid references public.profiles (id) on delete set null,
  opened_at     timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_attendance_sessions_date
  on public.attendance_sessions (session_date desc);

-- Marks (student presses "I attended" while session is open) ------------------
create table if not exists public.attendance_marks (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  marked_at    timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists idx_attendance_marks_student
  on public.attendance_marks (student_id);

create index if not exists idx_attendance_marks_session
  on public.attendance_marks (session_id);

-- Avatars bucket --------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS -------------------------------------------------------------------------
alter table public.attendance_sessions enable row level security;
alter table public.attendance_marks enable row level security;

drop policy if exists "attendance_sessions_select" on public.attendance_sessions;
create policy "attendance_sessions_select" on public.attendance_sessions
  for select to authenticated
  using (true);

drop policy if exists "attendance_sessions_write_teacher" on public.attendance_sessions;
create policy "attendance_sessions_write_teacher" on public.attendance_sessions
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "attendance_marks_select" on public.attendance_marks;
create policy "attendance_marks_select" on public.attendance_marks
  for select to authenticated
  using (
    public.is_teacher()
    or student_id = public.my_student_id()
  );

-- Students may insert only their own mark, and only while session is open
drop policy if exists "attendance_marks_insert_student" on public.attendance_marks;
create policy "attendance_marks_insert_student" on public.attendance_marks
  for insert to authenticated
  with check (
    student_id = public.my_student_id()
    and exists (
      select 1 from public.attendance_sessions s
      where s.id = session_id and s.status = 'open'
    )
  );

-- No student updates/deletes of marks
drop policy if exists "attendance_marks_delete_teacher" on public.attendance_marks;
create policy "attendance_marks_delete_teacher" on public.attendance_marks
  for delete to authenticated
  using (public.is_teacher());
