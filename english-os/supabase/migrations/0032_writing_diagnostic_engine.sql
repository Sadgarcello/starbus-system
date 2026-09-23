-- 0032_writing_diagnostic_engine.sql — TOEFL-style Writing diagnostic (12 items, Gemini-cached)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'writing_diagnostic_item_type') then
    create type writing_diagnostic_item_type as enum (
      'BUILD_SENTENCE',
      'EMAIL',
      'ACADEMIC_DISCUSSION'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'writing_ai_status') then
    create type writing_ai_status as enum ('pending', 'processing', 'complete', 'failed');
  end if;
end$$;

create table if not exists public.writing_build_sentence_items (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  target_sentence text not null,
  word_bank jsonb not null default '[]'::jsonb,
  accepted_variants jsonb not null default '[]'::jsonb,
  grammar_structure text,
  skill text,
  subskill text,
  difficulty numeric(4,2) not null check (difficulty between 1 and 10),
  cefr_level text not null default 'B1',
  explanation text,
  order_hint integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.writing_email_tasks (
  id uuid primary key default gen_random_uuid(),
  scenario text not null,
  audience text not null,
  purpose text not null,
  instructions text not null,
  required_components jsonb not null default '[]'::jsonb,
  difficulty numeric(4,2) not null check (difficulty between 1 and 10),
  cefr_level text not null default 'B1',
  rubric_metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.writing_academic_discussions (
  id uuid primary key default gen_random_uuid(),
  professor_prompt text not null,
  discussion_question text not null,
  participant_one_name text not null default 'Alex',
  participant_one_response text not null,
  participant_two_name text not null default 'Jordan',
  participant_two_response text not null,
  task_instruction text not null default 'Write a response that contributes to the discussion.',
  difficulty numeric(4,2) not null check (difficulty between 1 and 10),
  cefr_level text not null default 'B1',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.writing_diagnostic_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  recurring_errors jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  last_score integer,
  last_estimated_cefr text,
  history_scores jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.writing_diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  current_index integer not null default 0,
  time_limit_seconds integer not null default 1380,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  item_plan jsonb not null default '[]'::jsonb,
  draft_responses jsonb not null default '{}'::jsonb,
  diagnostic_report jsonb,
  ai_status writing_ai_status not null default 'pending',
  ai_error text,
  estimated_cefr text,
  diagnostic_score integer check (diagnostic_score between 0 and 100),
  counts_toward_limit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_writing_sessions_student
  on public.writing_diagnostic_sessions(student_id, created_at desc);

create table if not exists public.writing_diagnostic_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.writing_diagnostic_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  item_index integer not null check (item_index between 0 and 11),
  item_type writing_diagnostic_item_type not null,
  item_id uuid not null,
  response_text text not null default '',
  build_result jsonb,
  submitted_at timestamptz not null default now(),
  unique (session_id, item_index)
);

create table if not exists public.writing_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.writing_diagnostic_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  input_hash text not null,
  email_analysis jsonb,
  discussion_analysis jsonb,
  combined_errors jsonb not null default '[]'::jsonb,
  dimension_scores jsonb not null default '{}'::jsonb,
  exercises jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  model_used text,
  created_at timestamptz not null default now()
);

create index if not exists idx_writing_ai_student on public.writing_ai_analyses(student_id, created_at desc);

create table if not exists public.writing_test_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid not null unique references public.writing_diagnostic_sessions(id) on delete cascade,
  completed_at timestamptz not null default now()
);

create index if not exists idx_writing_completions_student_time
  on public.writing_test_completions(student_id, completed_at desc);

alter table public.writing_build_sentence_items enable row level security;
alter table public.writing_email_tasks enable row level security;
alter table public.writing_academic_discussions enable row level security;
alter table public.writing_diagnostic_profiles enable row level security;
alter table public.writing_diagnostic_sessions enable row level security;
alter table public.writing_diagnostic_attempts enable row level security;
alter table public.writing_ai_analyses enable row level security;
alter table public.writing_test_completions enable row level security;

create policy wbs_select on public.writing_build_sentence_items for select to authenticated
  using (active = true or public.is_teacher());
create policy wbs_write on public.writing_build_sentence_items for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

create policy wet_select on public.writing_email_tasks for select to authenticated
  using (active = true or public.is_teacher());
create policy wet_write on public.writing_email_tasks for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

create policy wad_select on public.writing_academic_discussions for select to authenticated
  using (active = true or public.is_teacher());
create policy wad_write on public.writing_academic_discussions for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

create policy wdp_select on public.writing_diagnostic_profiles for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());

create policy wds_select on public.writing_diagnostic_sessions for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());
create policy wds_insert on public.writing_diagnostic_sessions for insert to authenticated
  with check (student_id = public.my_student_id());
create policy wds_update on public.writing_diagnostic_sessions for update to authenticated
  using (student_id = public.my_student_id());

create policy wda_select on public.writing_diagnostic_attempts for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());

create policy waia_select on public.writing_ai_analyses for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());

create policy wtc_select on public.writing_test_completions for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());

grant select on public.writing_build_sentence_items to authenticated;
grant select on public.writing_email_tasks to authenticated;
grant select on public.writing_academic_discussions to authenticated;
grant select, insert, update on public.writing_diagnostic_sessions to authenticated;
grant select on public.writing_diagnostic_profiles to authenticated;
grant select on public.writing_diagnostic_attempts to authenticated;
grant select on public.writing_ai_analyses to authenticated;
grant select on public.writing_test_completions to authenticated;
grant all on public.writing_build_sentence_items to authenticated;
grant all on public.writing_email_tasks to authenticated;
grant all on public.writing_academic_discussions to authenticated;
