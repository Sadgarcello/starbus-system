-- ============================================================================
-- 0017_ai_text_evaluations.sql
-- Khawaja AI Writing + Listening Coach — stored evaluations (V1 pilot).
-- Run after prior migrations in Supabase SQL Editor.
-- ============================================================================

create table if not exists public.ai_text_evaluations (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  source_type      text not null check (source_type in ('writing', 'listening')),
  source_id        uuid not null,
  input_snapshot   text not null,
  overall_score    smallint not null check (overall_score >= 0 and overall_score <= 10),
  estimated_cefr   text not null check (estimated_cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  summary          text not null,
  strengths        jsonb not null default '[]'::jsonb,
  improvements     jsonb not null default '[]'::jsonb,
  corrections      jsonb not null default '[]'::jsonb,
  coach_note       text not null default '',
  ai_model         text not null,
  created_at       timestamptz not null default now(),
  unique (source_type, source_id)
);

create index if not exists idx_ai_text_evaluations_student_created
  on public.ai_text_evaluations (student_id, created_at desc);

create index if not exists idx_ai_text_evaluations_source
  on public.ai_text_evaluations (source_type, source_id);

alter table public.ai_text_evaluations enable row level security;

drop policy if exists "ai_text_evaluations_select_own" on public.ai_text_evaluations;
create policy "ai_text_evaluations_select_own" on public.ai_text_evaluations
  for select to authenticated
  using (
    student_id = public.my_student_id()
    or public.is_teacher()
    or public.is_admin()
  );

grant select on table public.ai_text_evaluations to authenticated;
