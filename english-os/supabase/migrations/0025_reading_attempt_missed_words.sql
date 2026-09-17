-- Store per-blank missed words from Complete the Words (shown only in final session report)
alter table public.reading_attempts
  add column if not exists missed_words jsonb;

comment on column public.reading_attempts.missed_words is
  'Complete the Words only: [{ "word": "examined", "submitted": "examines" }]';
