-- Complete the Words uses full passage text only; blanks are computed at runtime.
alter table public.complete_words_questions
  drop column if exists target_word;
