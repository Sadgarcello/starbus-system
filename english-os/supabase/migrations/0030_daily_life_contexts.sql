-- 0030_daily_life_contexts.sql
-- One Daily Life context (notice, email, menu, etc.) can have multiple MCQ questions.

create table if not exists public.daily_life_contexts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  content_type text not null default 'NOTICE',
  cefr_level text not null,
  difficulty numeric(4,2) not null check (difficulty between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_life_questions
  add column if not exists context_id uuid references public.daily_life_contexts(id) on delete cascade;

alter table public.reading_practice_sessions
  add column if not exists current_daily_life_context_id uuid references public.daily_life_contexts(id) on delete set null;

create index if not exists idx_dl_contexts_active on public.daily_life_contexts(active, difficulty);
create index if not exists idx_dl_questions_context on public.daily_life_questions(context_id, active);

-- Backfill: one context per unique title + content + content_type
insert into public.daily_life_contexts (title, content, content_type, cefr_level, difficulty, active)
select
  q.title,
  q.content,
  q.content_type,
  min(q.cefr_level),
  min(q.difficulty),
  bool_or(q.active)
from public.daily_life_questions q
where q.context_id is null
  and not exists (
    select 1 from public.daily_life_contexts c
    where c.title = q.title and c.content = q.content and c.content_type = q.content_type
  )
group by q.title, q.content, q.content_type;

update public.daily_life_questions q
set context_id = c.id
from public.daily_life_contexts c
where q.context_id is null
  and c.title = q.title
  and c.content = q.content
  and c.content_type = q.content_type;

-- Ella Bottled Water — two questions on one notice (TOEFL-style)
insert into public.daily_life_contexts (title, content, content_type, cefr_level, difficulty, active)
select
  'Ella Bottled Water (1 Case)',
  E'Contains: 12 bottles, 150 centilitres each\nIngredient: Natural mineral water\nProduced by: The Pureway Company, Lagos Mainland, Nigeria\nCost: N1,000\n1234567890',
  'NOTICE',
  'B1',
  4,
  true
where not exists (
  select 1 from public.daily_life_contexts c where c.title = 'Ella Bottled Water (1 Case)'
);

insert into public.daily_life_questions (
  context_id, title, content, content_type, cefr_level, difficulty, skill, question,
  option_a, option_b, option_c, option_d, correct_option, explanation, active
)
select
  c.id,
  c.title,
  c.content,
  c.content_type,
  c.cefr_level,
  c.difficulty,
  v.skill::reading_skill,
  v.question,
  v.option_a,
  v.option_b,
  v.option_c,
  v.option_d,
  v.correct_option,
  v.explanation,
  true
from public.daily_life_contexts c
cross join (values
  (
    'DETAIL',
    'How many items are in one case?',
    '1', '12', '150', '1,000',
    'B', 'The notice says the case contains 12 bottles.'
  ),
  (
    'DETAIL',
    'What is the brand name of the product?',
    'Ella', 'Natural', 'Lagos', 'Mainland',
    'A', 'Ella is the brand named in the notice title.'
  )
) as v(skill, question, option_a, option_b, option_c, option_d, correct_option, explanation)
where c.title = 'Ella Bottled Water (1 Case)'
  and not exists (
    select 1 from public.daily_life_questions q
    where q.context_id = c.id and q.question = v.question
  );

-- Second question for Library Notice (same context, two questions)
insert into public.daily_life_questions (
  context_id, title, content, content_type, cefr_level, difficulty, skill, question,
  option_a, option_b, option_c, option_d, correct_option, explanation, active
)
select
  c.id,
  c.title,
  c.content,
  c.content_type,
  c.cefr_level,
  c.difficulty,
  'DETAIL'::reading_skill,
  'What time should students borrow books by?',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM',
  'B',
  'Borrow books before 5:30 PM because the library closes at 6:00 PM.',
  true
from public.daily_life_contexts c
where c.title = 'Library Notice'
  and not exists (
    select 1 from public.daily_life_questions q
    where q.context_id = c.id and q.question = 'What time should students borrow books by?'
  );

alter table public.daily_life_contexts enable row level security;

drop policy if exists dl_contexts_select on public.daily_life_contexts;
drop policy if exists dl_contexts_write on public.daily_life_contexts;

create policy dl_contexts_select on public.daily_life_contexts
  for select to authenticated
  using (active = true or public.is_teacher());

create policy dl_contexts_write on public.daily_life_contexts
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

grant select on public.daily_life_contexts to authenticated;
grant all on public.daily_life_contexts to authenticated;
