-- 0020_social_exam_track.sql
-- Include exam track on public social profile cards.

drop function if exists public.list_social_profiles();

create or replace function public.list_social_profiles()
returns table (
  student_id uuid,
  name text,
  avatar text,
  level text,
  xp integer,
  streak integer,
  speaking_progress integer,
  reading_progress integer,
  joined_date date,
  exam_track exam_track
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id as student_id,
    coalesce(nullif(trim(p.name), ''), 'Student') as name,
    p.avatar,
    s.level,
    s.xp,
    s.streak,
    coalesce(s.speaking_progress, 0) as speaking_progress,
    coalesce(s.reading_progress, 0) as reading_progress,
    s.joined_date,
    s.exam_track
  from public.students s
  join public.profiles p on p.id = s.user_id
  where p.role = 'student'
    and p.status = 'active'
    and coalesce(p.is_locked, false) = false
    and public.is_active_member()
  order by s.xp desc, p.name asc nulls last;
$$;

grant execute on function public.list_social_profiles() to authenticated;
