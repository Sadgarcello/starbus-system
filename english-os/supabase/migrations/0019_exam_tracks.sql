-- 0019_exam_tracks.sql
-- Students choose TOEFL, IELTS, or Linguaskill — shapes skill module focus.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'exam_track') then
    create type exam_track as enum ('toefl', 'ielts', 'linguaskill');
  end if;
end$$;

alter table public.students
  add column if not exists exam_track exam_track;

comment on column public.students.exam_track is
  'Student-selected exam prep track; null until chosen in profile/settings.';
