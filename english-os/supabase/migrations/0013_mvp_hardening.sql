-- ============================================================================
-- 0013_mvp_hardening.sql
-- Security + integrity for go-live. Run after 0012 in Khawaja Club DB SQL Editor.
-- ============================================================================

-- Locked staff cannot exercise teacher/admin powers --------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
      and coalesce(is_locked, false) = false
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
      and coalesce(is_locked, false) = false
  );
$$;

-- Signup: never trust client role / pre_approved metadata --------------------------
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
begin
  display_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- Public signup is always pending student (ignore client "role" / "pre_approved")
  req_role := coalesce((new.raw_user_meta_data->>'requested_role')::user_role, 'student');
  if req_role not in ('student', 'teacher') then
    req_role := 'student';
  end if;

  chosen_role := 'student';
  chosen_status := 'pending'::account_status;

  -- First user becomes active admin
  if not exists (select 1 from public.profiles) then
    chosen_role := 'admin';
    req_role := 'admin';
    chosen_status := 'active';
  end if;

  insert into public.profiles (id, email, name, role, status, requested_role)
  values (new.id, new.email, display_name, chosen_role, chosen_status, req_role);

  return new;
end;
$$;

-- Allow SECURITY DEFINER RPCs to update protected profile fields -------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.bypass_profile_guard', true), 'off') = 'on' then
    return new;
  end if;

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

-- Teacher/admin activates a freshly signed-up student (Studio create) --------------
create or replace function public.teacher_provision_student(
  target_user_id uuid,
  p_level text default 'A1',
  p_teacher_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lvl text;
  tid uuid;
begin
  if not public.is_teacher() then
    raise exception 'insufficient_privilege';
  end if;

  if target_user_id is null then
    raise exception 'target_required';
  end if;

  lvl := coalesce(nullif(trim(p_level), ''), 'A1');
  tid := coalesce(p_teacher_id, auth.uid());

  perform set_config('app.bypass_profile_guard', 'on', true);

  update public.profiles
  set status = 'active',
      role = 'student',
      is_locked = false
  where id = target_user_id;

  if not found then
    raise exception 'member_not_found';
  end if;

  insert into public.students (user_id, level, teacher_id)
  values (target_user_id, lvl, tid)
  on conflict (user_id) do update
    set level = excluded.level,
        teacher_id = coalesce(excluded.teacher_id, public.students.teacher_id);
end;
$$;

grant execute on function public.teacher_provision_student(uuid, text, uuid) to authenticated;

-- Also bypass guard in existing admin RPCs ----------------------------------------
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

  perform set_config('app.bypass_profile_guard', 'on', true);

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

  perform set_config('app.bypass_profile_guard', 'on', true);

  update public.profiles
  set status = 'rejected'
  where id = target_id;
end;
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

  perform set_config('app.bypass_profile_guard', 'on', true);

  update public.profiles
  set is_locked = locked
  where id = target_id;
end;
$$;

-- Freeze progress fields unless teacher/admin (or bypass) --------------------------
create or replace function public.guard_student_progress_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.bypass_student_guard', true), 'off') = 'on' then
    return new;
  end if;

  if public.is_teacher() then
    return new;
  end if;

  -- Students may only touch non-progress columns (none currently from client)
  new.xp := old.xp;
  new.streak := old.streak;
  new.level := old.level;
  new.speaking_progress := old.speaking_progress;
  new.reading_progress := old.reading_progress;
  new.teacher_id := old.teacher_id;
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists trg_guard_student_progress on public.students;
create trigger trg_guard_student_progress
  before update on public.students
  for each row execute function public.guard_student_progress_update();

-- Students may only move assignments assigned/returned → submitted -----------------
create or replace function public.guard_assignment_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_teacher() then
    return new;
  end if;

  if old.student_id is distinct from public.my_student_id() then
    raise exception 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    if not (
      old.status in ('assigned', 'returned')
      and new.status = 'submitted'
    ) then
      raise exception 'invalid_assignment_status_transition';
    end if;
  end if;

  new.student_id := old.student_id;
  new.activity_id := old.activity_id;
  new.assigned_by := old.assigned_by;
  return new;
end;
$$;

drop trigger if exists trg_guard_assignment_status on public.assignments;
create trigger trg_guard_assignment_status
  before update on public.assignments
  for each row execute function public.guard_assignment_status_update();

-- Students cannot self-grade writing submissions -----------------------------------
create or replace function public.guard_writing_submission_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_teacher() then
    return new;
  end if;

  if old.student_id is distinct from public.my_student_id() then
    raise exception 'insufficient_privilege';
  end if;

  new.feedback := old.feedback;
  new.grade := old.grade;
  new.student_id := old.student_id;
  new.task_id := old.task_id;

  if new.status is distinct from old.status and new.status = 'reviewed' then
    raise exception 'students_cannot_review';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_writing_submission on public.writing_submissions;
create trigger trg_guard_writing_submission
  before update on public.writing_submissions
  for each row execute function public.guard_writing_submission_update();

-- Attendance streak: update on each mark -------------------------------------------
create or replace function public.refresh_attendance_streak(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  streak_count int := 0;
  cursor_date date;
  expected date;
begin
  select max(s.session_date)
  into cursor_date
  from public.attendance_marks m
  join public.attendance_sessions s on s.id = m.session_id
  where m.student_id = p_student_id;

  if cursor_date is null then
    perform set_config('app.bypass_student_guard', 'on', true);
    update public.students set streak = 0 where id = p_student_id;
    return;
  end if;

  expected := cursor_date;
  for cursor_date in
    select s.session_date
    from public.attendance_marks m
    join public.attendance_sessions s on s.id = m.session_id
    where m.student_id = p_student_id
    order by s.session_date desc
  loop
    if cursor_date = expected then
      streak_count := streak_count + 1;
      expected := expected - 1;
    else
      exit;
    end if;
  end loop;

  perform set_config('app.bypass_student_guard', 'on', true);
  update public.students set streak = streak_count where id = p_student_id;
end;
$$;

create or replace function public.trg_attendance_mark_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_attendance_streak(new.student_id);
  return new;
end;
$$;

drop trigger if exists trg_attendance_mark_streak on public.attendance_marks;
create trigger trg_attendance_mark_streak
  after insert on public.attendance_marks
  for each row execute function public.trg_attendance_mark_streak();

-- Patch progress RPCs to bypass student guard (keep original signatures) ----------
create or replace function public.apply_reading_progress_to_attendees(
  p_book_id uuid,
  p_session_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  book public.reading_books%rowtype;
  pct integer;
  updated_count integer := 0;
begin
  if not public.is_teacher() then
    raise exception 'insufficient_privilege';
  end if;

  select * into book from public.reading_books where id = p_book_id;
  if book.id is null then
    raise exception 'book_not_found';
  end if;

  if book.total_pages <= 0 then
    raise exception 'invalid_total_pages';
  end if;

  pct := least(100, greatest(0, round((book.pages_finished::numeric / book.total_pages::numeric) * 100)));

  perform set_config('app.bypass_student_guard', 'on', true);

  update public.students s
  set reading_progress = pct
  where s.id in (
    select m.student_id
    from public.attendance_marks m
    join public.attendance_sessions sess on sess.id = m.session_id
    where sess.session_date = p_session_date
  );

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

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

  perform set_config('app.bypass_student_guard', 'on', true);

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

grant execute on function public.mark_speaking_practice(uuid) to authenticated;
grant execute on function public.apply_reading_progress_to_attendees(uuid, date) to authenticated;

-- Award XP + mark assignment reviewed when a teacher review is inserted -----------
create or replace function public.trg_review_award_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  aid uuid;
begin
  select s.student_id, s.assignment_id
  into sid, aid
  from public.submissions s
  where s.id = new.submission_id;

  if sid is not null then
    perform set_config('app.bypass_student_guard', 'on', true);
    update public.students
    set xp = coalesce(xp, 0) + coalesce(new.xp_awarded, 0)
    where id = sid;
  end if;

  if aid is not null then
    update public.assignments
    set status = 'reviewed',
        updated_at = now()
    where id = aid;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_review_award_xp on public.reviews;
create trigger trg_review_award_xp
  after insert on public.reviews
  for each row execute function public.trg_review_award_xp();

-- Explicit grants for early tables -------------------------------------------------
grant select, insert, update, delete on table public.attendance_sessions to authenticated;
grant select, insert, update, delete on table public.attendance_marks to authenticated;
grant select, update on table public.students to authenticated;
grant select, insert, update on table public.assignments to authenticated;
grant select, insert, update on table public.submissions to authenticated;
grant select, insert on table public.reviews to authenticated;
grant select on table public.profiles to authenticated;
