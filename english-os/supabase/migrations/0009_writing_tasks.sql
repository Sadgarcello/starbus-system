-- ============================================================================
-- 0009_writing_tasks.sql
-- End-of-class writing assignments: paste text and/or upload handwritten photo.
-- Run after prior migrations in Khawaja Club DB SQL Editor.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'writing_task_status') then
    create type writing_task_status as enum ('open', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'writing_submission_status') then
    create type writing_submission_status as enum ('submitted', 'reviewed');
  end if;
end$$;

create table if not exists public.writing_tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  instructions  text not null,
  session_date  date not null default current_date,
  status        writing_task_status not null default 'open',
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);

create index if not exists idx_writing_tasks_date
  on public.writing_tasks (session_date desc, created_at desc);

create table if not exists public.writing_submissions (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.writing_tasks (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  body_text     text,
  photo_path    text,
  status        writing_submission_status not null default 'submitted',
  feedback      text,
  grade         text,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  unique (task_id, student_id),
  check (
    (body_text is not null and length(trim(body_text)) > 0)
    or (photo_path is not null and length(trim(photo_path)) > 0)
  )
);

create index if not exists idx_writing_submissions_task
  on public.writing_submissions (task_id);

create index if not exists idx_writing_submissions_student
  on public.writing_submissions (student_id);

-- Photos of handwritten work --------------------------------------------------
insert into storage.buckets (id, name, public)
values ('writing-photos', 'writing-photos', false)
on conflict (id) do nothing;

drop policy if exists "writing_photos_select" on storage.objects;
create policy "writing_photos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'writing-photos');

drop policy if exists "writing_photos_insert" on storage.objects;
create policy "writing_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'writing-photos'
    and (
      public.is_teacher()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "writing_photos_update" on storage.objects;
create policy "writing_photos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'writing-photos'
    and (
      public.is_teacher()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'writing-photos'
    and (
      public.is_teacher()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "writing_photos_delete" on storage.objects;
create policy "writing_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'writing-photos'
    and (
      public.is_teacher()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- RLS -------------------------------------------------------------------------
alter table public.writing_tasks enable row level security;
alter table public.writing_submissions enable row level security;

drop policy if exists "writing_tasks_select" on public.writing_tasks;
create policy "writing_tasks_select" on public.writing_tasks
  for select to authenticated using (true);

drop policy if exists "writing_tasks_write_teacher" on public.writing_tasks;
create policy "writing_tasks_write_teacher" on public.writing_tasks
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "writing_submissions_select" on public.writing_submissions;
create policy "writing_submissions_select" on public.writing_submissions
  for select to authenticated
  using (
    public.is_teacher()
    or student_id = public.my_student_id()
  );

drop policy if exists "writing_submissions_insert_student" on public.writing_submissions;
create policy "writing_submissions_insert_student" on public.writing_submissions
  for insert to authenticated
  with check (
    student_id = public.my_student_id()
    and exists (
      select 1 from public.writing_tasks t
      where t.id = task_id and t.status = 'open'
    )
  );

drop policy if exists "writing_submissions_update_own" on public.writing_submissions;
create policy "writing_submissions_update_own" on public.writing_submissions
  for update to authenticated
  using (
    (
      student_id = public.my_student_id()
      and status = 'submitted'
      and exists (
        select 1 from public.writing_tasks t
        where t.id = task_id and t.status = 'open'
      )
    )
    or public.is_teacher()
  )
  with check (
    student_id = public.my_student_id()
    or public.is_teacher()
  );

grant select, insert, update, delete on table public.writing_tasks to authenticated;
grant select, insert, update, delete on table public.writing_submissions to authenticated;
