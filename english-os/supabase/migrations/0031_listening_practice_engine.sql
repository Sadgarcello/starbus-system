-- 0031_listening_practice_engine.sql
-- TOEFL 2026-aligned listening practice: stimuli + grouped questions, multistage modules.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'listening_task_type') then
    create type listening_task_type as enum (
      'CHOOSE_RESPONSE',
      'CONVERSATION',
      'ANNOUNCEMENT',
      'ACADEMIC_TALK'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'listening_skill') then
    create type listening_skill as enum (
      'APPROPRIATE_RESPONSE',
      'MAIN_IDEA',
      'DETAIL',
      'INFERENCE',
      'PURPOSE',
      'SPEAKER_INTENT',
      'SPEAKER_ATTITUDE',
      'ORGANIZATION',
      'FUNCTION',
      'VOCABULARY_IN_CONTEXT',
      'NEXT_ACTION'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'listening_module_phase') then
    create type listening_module_phase as enum ('LOWER', 'UPPER', 'COMPLETED');
  end if;
  if not exists (select 1 from pg_type where typname = 'listening_practice_mode') then
    create type listening_practice_mode as enum ('PLACEMENT', 'PRACTICE');
  end if;
end$$;

-- One audio stimulus → many questions (or one for Choose Response)
create table if not exists public.listening_stimuli (
  id uuid primary key default gen_random_uuid(),
  task_type listening_task_type not null,
  title text not null,
  audio_path text not null,
  duration_seconds integer,
  transcript text,
  accent text default 'north_american',
  academic_field text,
  cefr_level text not null default 'B1',
  overall_difficulty numeric(4,2) not null check (overall_difficulty between 1 and 10),
  speaker_portraits jsonb not null default '[]'::jsonb,
  context_tags text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listening_questions (
  id uuid primary key default gen_random_uuid(),
  stimulus_id uuid not null references public.listening_stimuli(id) on delete cascade,
  question_text text not null default '',
  skill listening_skill not null,
  difficulty numeric(4,2) not null check (difficulty between 1 and 10),
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listening_questions_stimulus_order
  on public.listening_questions(stimulus_id, order_index);

create table if not exists public.listening_practice_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  overall_listening_difficulty numeric(4,2) not null default 4,
  estimated_cefr text,
  total_attempts integer not null default 0,
  total_correct integer not null default 0,
  overall_accuracy numeric(5,2) not null default 0,
  highest_difficulty numeric(4,2) not null default 1,
  last_practice_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listening_practice_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  mode listening_practice_mode not null default 'PLACEMENT',
  module_phase listening_module_phase not null default 'LOWER',
  upper_routing_band integer check (upper_routing_band between 1 and 3),
  lower_module_score numeric(5,2),
  items_answered integer not null default 0,
  items_correct integer not null default 0,
  current_stimulus_id uuid references public.listening_stimuli(id) on delete set null,
  awaiting_playback boolean not null default false,
  current_question_index integer not null default 0,
  used_stimulus_ids uuid[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  results_report jsonb,
  estimated_cefr text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listening_sessions_student
  on public.listening_practice_sessions(student_id, created_at desc);

create table if not exists public.listening_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid not null references public.listening_practice_sessions(id) on delete cascade,
  stimulus_id uuid not null references public.listening_stimuli(id) on delete cascade,
  question_id uuid not null references public.listening_questions(id) on delete cascade,
  module_phase listening_module_phase not null,
  task_type listening_task_type not null,
  skill listening_skill not null,
  difficulty numeric(4,2) not null,
  answer text not null,
  correct boolean not null,
  response_time_ms integer,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_listening_attempts_session
  on public.listening_attempts(session_id, attempted_at);

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listening-audio',
  'listening-audio',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'audio/webm']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listening-speakers',
  'listening-speakers',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

alter table public.listening_stimuli enable row level security;
alter table public.listening_questions enable row level security;
alter table public.listening_practice_profiles enable row level security;
alter table public.listening_practice_sessions enable row level security;
alter table public.listening_attempts enable row level security;

drop policy if exists listening_stimuli_select on public.listening_stimuli;
drop policy if exists listening_stimuli_write on public.listening_stimuli;
drop policy if exists listening_questions_select on public.listening_questions;
drop policy if exists listening_questions_write on public.listening_questions;
drop policy if exists listening_profiles_select on public.listening_practice_profiles;
drop policy if exists listening_sessions_select on public.listening_practice_sessions;
drop policy if exists listening_sessions_insert on public.listening_practice_sessions;
drop policy if exists listening_attempts_select on public.listening_attempts;

create policy listening_stimuli_select on public.listening_stimuli
  for select to authenticated
  using (active = true or public.is_teacher());

create policy listening_stimuli_write on public.listening_stimuli
  for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

create policy listening_questions_select on public.listening_questions
  for select to authenticated
  using (
    active = true
    or public.is_teacher()
  );

create policy listening_questions_write on public.listening_questions
  for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

create policy listening_profiles_select on public.listening_practice_profiles
  for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());

create policy listening_sessions_select on public.listening_practice_sessions
  for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());

create policy listening_sessions_insert on public.listening_practice_sessions
  for insert to authenticated
  with check (student_id = public.my_student_id());

create policy listening_sessions_update on public.listening_practice_sessions
  for update to authenticated
  using (student_id = public.my_student_id());

create policy listening_attempts_select on public.listening_attempts
  for select to authenticated
  using (student_id = public.my_student_id() or public.is_teacher());

-- Teachers upload audio; students get signed URLs via service role API only for playback paths
drop policy if exists listening_audio_teacher_write on storage.objects;
drop policy if exists listening_audio_teacher_read on storage.objects;
drop policy if exists listening_speakers_teacher_write on storage.objects;
drop policy if exists listening_speakers_teacher_read on storage.objects;

create policy listening_audio_teacher_write on storage.objects
  for all to authenticated
  using (bucket_id = 'listening-audio' and public.is_teacher())
  with check (bucket_id = 'listening-audio' and public.is_teacher());

create policy listening_audio_teacher_read on storage.objects
  for select to authenticated
  using (bucket_id = 'listening-audio' and public.is_teacher());

create policy listening_speakers_teacher_write on storage.objects
  for all to authenticated
  using (bucket_id = 'listening-speakers' and public.is_teacher())
  with check (bucket_id = 'listening-speakers' and public.is_teacher());

create policy listening_speakers_teacher_read on storage.objects
  for select to authenticated
  using (bucket_id = 'listening-speakers' and public.is_teacher());

grant select on public.listening_stimuli to authenticated;
grant select on public.listening_questions to authenticated;
grant select, insert on public.listening_practice_sessions to authenticated;
grant select on public.listening_practice_profiles to authenticated;
grant select on public.listening_attempts to authenticated;
grant all on public.listening_stimuli to authenticated;
grant all on public.listening_questions to authenticated;

comment on column public.listening_stimuli.transcript is 'Admin only — never sent to students during placement.';
comment on column public.listening_stimuli.speaker_portraits is 'JSON array: [{name, role, imagePath}] content-specific visuals.';
