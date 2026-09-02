-- 0021_reading_practice_engine.sql
-- TOEFL-style adaptive reading practice (no AI). TOEFL students only at app layer.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reading_question_type') then
    create type reading_question_type as enum ('COMPLETE_WORDS', 'DAILY_LIFE', 'ACADEMIC');
  end if;
  if not exists (select 1 from pg_type where typname = 'reading_skill') then
    create type reading_skill as enum (
      'VOCABULARY', 'SPELLING', 'MAIN_IDEA', 'DETAIL', 'INFERENCE',
      'VOCABULARY_CONTEXT', 'PURPOSE', 'REFERENCE', 'RELATIONSHIP'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'reading_practice_mode') then
    create type reading_practice_mode as enum (
      'ADAPTIVE', 'COMPLETE_WORDS', 'DAILY_LIFE', 'ACADEMIC'
    );
  end if;
end$$;

-- Practice profile (separate from official students.level CEFR)
create table if not exists public.reading_practice_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  overall_reading_difficulty numeric(4,2) not null default 4,
  complete_words_difficulty numeric(4,2) not null default 4,
  daily_life_difficulty numeric(4,2) not null default 4,
  academic_difficulty numeric(4,2) not null default 4,
  vocabulary_score numeric(5,2) not null default 50,
  spelling_score numeric(5,2) not null default 50,
  academic_vocabulary_score numeric(5,2) not null default 50,
  main_idea_score numeric(5,2) not null default 50,
  detail_score numeric(5,2) not null default 50,
  inference_score numeric(5,2) not null default 50,
  vocabulary_context_score numeric(5,2) not null default 50,
  purpose_score numeric(5,2) not null default 50,
  total_attempts integer not null default 0,
  total_correct integer not null default 0,
  overall_accuracy numeric(5,2) not null default 0,
  highest_difficulty numeric(4,2) not null default 1,
  last_practice_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complete_words_questions (
  id uuid primary key default gen_random_uuid(),
  sentence text not null,
  target_word text not null,
  cefr_level text not null,
  difficulty numeric(4,2) not null check (difficulty between 1 and 10),
  category text,
  explanation text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_life_questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  content_type text not null default 'NOTICE',
  cefr_level text not null,
  difficulty numeric(4,2) not null check (difficulty between 1 and 10),
  skill reading_skill not null,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_passages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  passage_text text not null,
  cefr_level text not null,
  difficulty numeric(4,2) not null check (difficulty between 1 and 10),
  topic text,
  word_count integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_questions (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.academic_passages(id) on delete cascade,
  question text not null,
  question_type text not null default 'MULTIPLE_CHOICE',
  skill reading_skill not null,
  difficulty numeric(4,2) not null check (difficulty between 1 and 10),
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_practice_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  mode reading_practice_mode not null default 'ADAPTIVE',
  target_length integer not null default 10 check (target_length between 1 and 20),
  questions_answered integer not null default 0,
  questions_correct integer not null default 0,
  starting_difficulty numeric(4,2) not null,
  ending_difficulty numeric(4,2),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  current_passage_id uuid references public.academic_passages(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.reading_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid references public.reading_practice_sessions(id) on delete set null,
  question_id uuid not null,
  question_type reading_question_type not null,
  skill reading_skill,
  cefr_level text,
  difficulty numeric(4,2),
  answer text,
  correct boolean not null,
  response_time_ms integer,
  attempted_at timestamptz not null default now()
);

create table if not exists public.reading_question_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  question_id uuid not null,
  question_type reading_question_type not null,
  shown_at timestamptz not null default now(),
  answered_at timestamptz,
  correct boolean,
  response_time_ms integer
);

create table if not exists public.complete_words_word_performance (
  student_id uuid not null references public.students(id) on delete cascade,
  question_id uuid not null references public.complete_words_questions(id) on delete cascade,
  word text not null,
  attempts integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  accuracy numeric(5,2) not null default 0,
  mastery_score numeric(5,2) not null default 0,
  consecutive_correct integer not null default 0,
  consecutive_incorrect integer not null default 0,
  last_attempted_at timestamptz,
  last_correct_at timestamptz,
  primary key (student_id, question_id)
);

-- Indexes
create index if not exists idx_cw_questions_active_diff on public.complete_words_questions(active, difficulty);
create index if not exists idx_dl_questions_active_diff on public.daily_life_questions(active, difficulty);
create index if not exists idx_academic_q_passage on public.academic_questions(passage_id, active);
create index if not exists idx_reading_attempts_student on public.reading_attempts(student_id, attempted_at desc);
create index if not exists idx_reading_history_student on public.reading_question_history(student_id, shown_at desc);
create index if not exists idx_reading_sessions_student on public.reading_practice_sessions(student_id, started_at desc);

-- RLS
alter table public.reading_practice_profiles enable row level security;
alter table public.complete_words_questions enable row level security;
alter table public.daily_life_questions enable row level security;
alter table public.academic_passages enable row level security;
alter table public.academic_questions enable row level security;
alter table public.reading_practice_sessions enable row level security;
alter table public.reading_attempts enable row level security;
alter table public.reading_question_history enable row level security;
alter table public.complete_words_word_performance enable row level security;

-- Teachers manage content; students read active content only (answers via API/RPC)
drop policy if exists cw_questions_select on public.complete_words_questions;
drop policy if exists cw_questions_write on public.complete_words_questions;
drop policy if exists dl_questions_select on public.daily_life_questions;
drop policy if exists dl_questions_write on public.daily_life_questions;
drop policy if exists academic_passages_select on public.academic_passages;
drop policy if exists academic_passages_write on public.academic_passages;
drop policy if exists academic_questions_select on public.academic_questions;
drop policy if exists academic_questions_write on public.academic_questions;
drop policy if exists reading_profiles_select on public.reading_practice_profiles;
drop policy if exists reading_profiles_insert on public.reading_practice_profiles;
drop policy if exists reading_profiles_update on public.reading_practice_profiles;
drop policy if exists reading_sessions_select on public.reading_practice_sessions;
drop policy if exists reading_sessions_insert on public.reading_practice_sessions;
drop policy if exists reading_sessions_update on public.reading_practice_sessions;
drop policy if exists reading_attempts_select on public.reading_attempts;
drop policy if exists reading_attempts_insert on public.reading_attempts;
drop policy if exists reading_history_select on public.reading_question_history;
drop policy if exists reading_history_insert on public.reading_question_history;
drop policy if exists reading_history_update on public.reading_question_history;
drop policy if exists cw_word_perf_select on public.complete_words_word_performance;
drop policy if exists cw_word_perf_write on public.complete_words_word_performance;

create policy cw_questions_select on public.complete_words_questions for select to authenticated using (active = true or public.is_teacher());
create policy cw_questions_write on public.complete_words_questions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy dl_questions_select on public.daily_life_questions for select to authenticated using (active = true or public.is_teacher());
create policy dl_questions_write on public.daily_life_questions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy academic_passages_select on public.academic_passages for select to authenticated using (active = true or public.is_teacher());
create policy academic_passages_write on public.academic_passages for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy academic_questions_select on public.academic_questions for select to authenticated using (active = true or public.is_teacher());
create policy academic_questions_write on public.academic_questions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy reading_profiles_select on public.reading_practice_profiles for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());
create policy reading_profiles_insert on public.reading_practice_profiles for insert to authenticated
  with check (student_id = public.my_student_id() or public.is_teacher());
create policy reading_profiles_update on public.reading_practice_profiles for update to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());

create policy reading_sessions_select on public.reading_practice_sessions for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());
create policy reading_sessions_insert on public.reading_practice_sessions for insert to authenticated
  with check (student_id = public.my_student_id());
create policy reading_sessions_update on public.reading_practice_sessions for update to authenticated
  using (student_id = public.my_student_id());

create policy reading_attempts_select on public.reading_attempts for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());
create policy reading_attempts_insert on public.reading_attempts for insert to authenticated
  with check (student_id = public.my_student_id());

create policy reading_history_select on public.reading_question_history for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());
create policy reading_history_insert on public.reading_question_history for insert to authenticated
  with check (student_id = public.my_student_id());
create policy reading_history_update on public.reading_question_history for update to authenticated
  using (student_id = public.my_student_id());

create policy cw_word_perf_select on public.complete_words_word_performance for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());
create policy cw_word_perf_write on public.complete_words_word_performance for all to authenticated
  using (student_id = public.my_student_id()) with check (student_id = public.my_student_id());

-- Block client updates to practice profile (API uses service role)
create or replace function public.guard_reading_practice_profile_update()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' and not public.is_teacher() then
    raise exception 'reading_practice_profile_locked';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_reading_practice_profile on public.reading_practice_profiles;
create trigger trg_guard_reading_practice_profile
  before update on public.reading_practice_profiles
  for each row execute function public.guard_reading_practice_profile_update();

grant select, insert on public.reading_practice_profiles to authenticated;
grant select, insert, update on public.reading_practice_sessions to authenticated;
grant select, insert on public.reading_attempts to authenticated;
grant select, insert, update on public.reading_question_history to authenticated;
grant select, insert, update on public.complete_words_word_performance to authenticated;
grant select on public.complete_words_questions to authenticated;
grant select on public.daily_life_questions to authenticated;
grant select on public.academic_passages to authenticated;
grant select on public.academic_questions to authenticated;
grant all on public.complete_words_questions to authenticated;
grant all on public.daily_life_questions to authenticated;
grant all on public.academic_passages to authenticated;
grant all on public.academic_questions to authenticated;
