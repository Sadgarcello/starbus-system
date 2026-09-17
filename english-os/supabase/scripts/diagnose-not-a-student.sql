-- ============================================================================
-- Diagnose "not_a_student" for reading practice
-- Run in Supabase SQL Editor (project: iqkbkdgcfaumpxvuttfw)
-- ============================================================================

-- 1) Active student profiles WITHOUT a students row (root cause of not_a_student)
select
  p.id as user_id,
  p.email,
  p.name,
  p.role,
  p.status,
  'MISSING students row — reading practice will fail' as diagnosis
from public.profiles p
left join public.students s on s.user_id = p.id
where p.role = 'student'
  and p.status = 'active'
  and s.id is null
order by p.email;

-- 2) Test Student specifically (adjust name/email if needed)
select
  p.id as user_id,
  p.email,
  p.name,
  p.role,
  p.status,
  s.id as student_row_id,
  s.exam_track,
  case
    when s.id is null then 'not_a_student — no students row'
    when s.exam_track is distinct from 'toefl' then 'toefl_only — set exam_track to toefl'
    else 'OK for reading practice'
  end as diagnosis
from public.profiles p
left join public.students s on s.user_id = p.id
where p.name ilike '%test%student%'
   or p.email ilike '%test%'
order by p.email;

-- 3) Count mismatch
select
  (select count(*) from public.profiles where role = 'student' and status = 'active') as active_student_profiles,
  (select count(*) from public.students) as students_rows,
  (select count(*)
   from public.profiles p
   left join public.students s on s.user_id = p.id
   where p.role = 'student' and p.status = 'active' and s.id is null) as profiles_missing_students_row;

-- 4) FIX — backfill missing students rows (safe to re-run)
-- insert into public.students (user_id, level, exam_track)
-- select p.id, 'A1', 'toefl'
-- from public.profiles p
-- left join public.students s on s.user_id = p.id
-- where p.role = 'student'
--   and p.status = 'active'
--   and s.id is null;
