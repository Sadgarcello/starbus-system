-- Persist full reading practice report for history and comparison
alter table public.reading_practice_sessions
  add column if not exists results_report jsonb;

comment on column public.reading_practice_sessions.results_report is
  'Detailed checklist, scores, level, and word breakdown saved when session completes';
