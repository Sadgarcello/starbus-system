-- ============================================================================
-- 0011_listening_picks.sql
-- Weekly Student Picks: clip + understanding + opinion.
-- Run after prior migrations in Khawaja Club DB SQL Editor.
-- ============================================================================

create table if not exists public.listening_picks (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  clip_name        text not null,
  topic            text not null,
  url              text,
  why_chose        text not null,
  what_understood  text not null,
  opinion          text not null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_listening_picks_created
  on public.listening_picks (created_at desc);

alter table public.listening_picks enable row level security;

drop policy if exists "listening_picks_select" on public.listening_picks;
create policy "listening_picks_select" on public.listening_picks
  for select to authenticated
  using (true);

drop policy if exists "listening_picks_insert_own" on public.listening_picks;
create policy "listening_picks_insert_own" on public.listening_picks
  for insert to authenticated
  with check (student_id = public.my_student_id());

drop policy if exists "listening_picks_update_own" on public.listening_picks;
create policy "listening_picks_update_own" on public.listening_picks
  for update to authenticated
  using (student_id = public.my_student_id() or public.is_teacher())
  with check (student_id = public.my_student_id() or public.is_teacher());

drop policy if exists "listening_picks_delete" on public.listening_picks;
create policy "listening_picks_delete" on public.listening_picks
  for delete to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());

grant select, insert, update, delete on table public.listening_picks to authenticated;
