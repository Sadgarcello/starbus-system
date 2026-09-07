-- Clear seeded reading practice content. Teachers add passages manually via admin.
-- Complete the Words: passage text only — blanks are computed at runtime.
-- Safe to re-run. Does not touch target_word (removed in 0024).

delete from public.reading_attempts;
delete from public.reading_question_history;
delete from public.complete_words_word_performance;
delete from public.complete_words_questions;
delete from public.academic_questions;
delete from public.academic_passages;
delete from public.daily_life_questions;

comment on column public.complete_words_questions.sentence is
  'Full passage text entered by teacher. Masking is applied automatically.';
