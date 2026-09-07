-- Clear seeded reading practice content. Teachers add passages manually via admin.
-- Complete the Words: passage text only — blanks are computed at runtime.

delete from public.reading_attempts;
delete from public.reading_question_history;
delete from public.complete_words_word_performance;
delete from public.complete_words_questions;
delete from public.academic_questions;
delete from public.academic_passages;
delete from public.daily_life_questions;

alter table public.complete_words_questions
  alter column target_word drop not null;

-- Removed in 0024_drop_complete_words_target_word.sql after deploy.
comment on column public.complete_words_questions.sentence is
  'Full passage text entered by teacher. Masking is applied automatically.';
