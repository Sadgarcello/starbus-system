-- Session-scoped adaptive difficulty for Complete the Words placement test
alter table public.reading_practice_sessions
  add column if not exists session_difficulty numeric(4,2),
  add column if not exists highest_difficulty_reached numeric(4,2);

comment on column public.reading_practice_sessions.session_difficulty is
  'Live adaptive difficulty during a session (next question selected from this level)';
comment on column public.reading_practice_sessions.highest_difficulty_reached is
  'Peak question difficulty successfully handled or attempted in the session';
