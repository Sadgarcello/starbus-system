-- ============================================================================
-- Khawaja Club — Activity Engine schema
-- Run in Supabase SQL Editor (new project recommended).
-- ============================================================================

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'teacher', 'student');
  end if;
  if not exists (select 1 from pg_type where typname = 'activity_type') then
    create type activity_type as enum ('speaking', 'reading', 'writing', 'listening');
  end if;
  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type assignment_status as enum ('assigned', 'submitted', 'reviewed', 'returned');
  end if;
end$$;

-- Profiles (1:1 with auth.users) ------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  name        text,
  role        user_role not null default 'student',
  avatar      text,
  created_at  timestamptz not null default now()
);

-- Students --------------------------------------------------------------------
create table if not exists public.students (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles (id) on delete cascade,
  level           text not null default 'A1',
  joined_date     date not null default current_date,
  current_course  text,
  xp              int not null default 0 check (xp >= 0),
  streak          int not null default 0 check (streak >= 0),
  subscription    text,
  teacher_id      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_students_teacher on public.students (teacher_id);

-- Courses / Lessons (swappable content) ---------------------------------------
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid references public.courses (id) on delete set null,
  title       text not null,
  week        int,
  theme       text,
  novel       text,
  chapter     text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_lessons_course on public.lessons (course_id);

-- Activities (Activity Engine core) -------------------------------------------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid references public.lessons (id) on delete set null,
  type        activity_type not null,
  title       text not null,
  description text,
  xp          int not null default 50 check (xp >= 0),
  metadata    jsonb not null default '{}'::jsonb,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_activities_type on public.activities (type);
create index if not exists idx_activities_lesson on public.activities (lesson_id);

-- Assignments -----------------------------------------------------------------
create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.activities (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  status       assignment_status not null default 'assigned',
  due_at       timestamptz,
  assigned_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (activity_id, student_id)
);

create index if not exists idx_assignments_student on public.assignments (student_id);
create index if not exists idx_assignments_status on public.assignments (status);

-- Submissions -----------------------------------------------------------------
create table if not exists public.submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null unique references public.assignments (id) on delete cascade,
  student_id     uuid not null references public.students (id) on delete cascade,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Reviews ---------------------------------------------------------------------
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null unique references public.submissions (id) on delete cascade,
  reviewer_id     uuid not null references public.profiles (id) on delete cascade,
  feedback        text,
  scores          jsonb not null default '{}'::jsonb,
  grade           text,
  xp_awarded      int not null default 0 check (xp_awarded >= 0),
  created_at      timestamptz not null default now()
);

-- Helpers ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_assignments_updated on public.assignments;
create trigger trg_assignments_updated
  before update on public.assignments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_submissions_updated on public.submissions;
create trigger trg_submissions_updated
  before update on public.submissions
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
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
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher')
  );
$$;

create or replace function public.my_student_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.students where user_id = auth.uid() limit 1;
$$;

-- Auth trigger: create profile (+ student row for students) --------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role user_role;
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  chosen_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'student');

  -- First user becomes admin
  if not exists (select 1 from public.profiles) then
    chosen_role := 'admin';
  end if;

  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, display_name, chosen_role);

  if chosen_role = 'student' then
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Award XP on review ----------------------------------------------------------
create or replace function public.apply_review_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  select s.student_id into sid from public.submissions s where s.id = new.submission_id;
  if sid is not null and new.xp_awarded > 0 then
    update public.students
    set xp = xp + new.xp_awarded
    where id = sid;
  end if;

  update public.assignments a
  set status = 'reviewed'
  from public.submissions s
  where s.id = new.submission_id and a.id = s.assignment_id;

  return new;
end;
$$;

drop trigger if exists trg_apply_review_xp on public.reviews;
create trigger trg_apply_review_xp
  after insert on public.reviews
  for each row execute function public.apply_review_xp();

-- RLS -------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.activities enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.reviews enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- students
drop policy if exists "students_select" on public.students;
create policy "students_select" on public.students
  for select to authenticated
  using (
    user_id = auth.uid()
    or teacher_id = auth.uid()
    or public.is_admin()
    or public.is_teacher()
  );

drop policy if exists "students_update_teacher_or_self" on public.students;
create policy "students_update_teacher_or_self" on public.students
  for update to authenticated
  using (user_id = auth.uid() or teacher_id = auth.uid() or public.is_admin() or public.is_teacher())
  with check (user_id = auth.uid() or teacher_id = auth.uid() or public.is_admin() or public.is_teacher());

drop policy if exists "students_insert_teacher" on public.students;
create policy "students_insert_teacher" on public.students
  for insert to authenticated
  with check (public.is_teacher() or public.is_admin());

-- courses / lessons / activities — teachers write, all authenticated read
drop policy if exists "courses_select" on public.courses;
create policy "courses_select" on public.courses for select to authenticated using (true);
drop policy if exists "courses_write" on public.courses;
create policy "courses_write" on public.courses for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "lessons_select" on public.lessons;
create policy "lessons_select" on public.lessons for select to authenticated using (true);
drop policy if exists "lessons_write" on public.lessons;
create policy "lessons_write" on public.lessons for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "activities_select" on public.activities;
create policy "activities_select" on public.activities for select to authenticated using (true);
drop policy if exists "activities_write" on public.activities;
create policy "activities_write" on public.activities for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- assignments
drop policy if exists "assignments_select" on public.assignments;
create policy "assignments_select" on public.assignments
  for select to authenticated
  using (
    public.is_teacher()
    or student_id = public.my_student_id()
  );

drop policy if exists "assignments_insert_teacher" on public.assignments;
create policy "assignments_insert_teacher" on public.assignments
  for insert to authenticated
  with check (public.is_teacher());

drop policy if exists "assignments_update" on public.assignments;
create policy "assignments_update" on public.assignments
  for update to authenticated
  using (public.is_teacher() or student_id = public.my_student_id())
  with check (public.is_teacher() or student_id = public.my_student_id());

-- submissions
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select to authenticated
  using (public.is_teacher() or student_id = public.my_student_id());

drop policy if exists "submissions_insert_student" on public.submissions;
create policy "submissions_insert_student" on public.submissions
  for insert to authenticated
  with check (student_id = public.my_student_id());

drop policy if exists "submissions_update_student" on public.submissions;
create policy "submissions_update_student" on public.submissions
  for update to authenticated
  using (student_id = public.my_student_id())
  with check (student_id = public.my_student_id());

-- reviews
drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews
  for select to authenticated
  using (
    public.is_teacher()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.student_id = public.my_student_id()
    )
  );

drop policy if exists "reviews_insert_teacher" on public.reviews;
create policy "reviews_insert_teacher" on public.reviews
  for insert to authenticated
  with check (public.is_teacher() and reviewer_id = auth.uid());
