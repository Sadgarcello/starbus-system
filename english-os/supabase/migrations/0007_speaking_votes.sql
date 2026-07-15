-- ============================================================================
-- 0007_speaking_votes.sql
-- Students vote for one preferred speaking format; everyone sees voters + avatars.
-- Run after 0006 in Khawaja Club DB SQL Editor.
-- ============================================================================

create table if not exists public.speaking_format_votes (
  student_id  uuid primary key references public.students (id) on delete cascade,
  format_id   uuid not null references public.speaking_formats (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_speaking_votes_format
  on public.speaking_format_votes (format_id);

create or replace function public.vote_speaking_format(p_format_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid := public.my_student_id();
begin
  if sid is null then
    raise exception 'student_profile_required';
  end if;

  if not exists (select 1 from public.speaking_formats where id = p_format_id) then
    raise exception 'format_not_found';
  end if;

  insert into public.speaking_format_votes (student_id, format_id, updated_at)
  values (sid, p_format_id, now())
  on conflict (student_id) do update
    set format_id = excluded.format_id,
        updated_at = now();
end;
$$;

create or replace function public.clear_speaking_vote()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid := public.my_student_id();
begin
  if sid is null then
    raise exception 'student_profile_required';
  end if;

  delete from public.speaking_format_votes where student_id = sid;
end;
$$;

grant execute on function public.vote_speaking_format(uuid) to authenticated;
grant execute on function public.clear_speaking_vote() to authenticated;

alter table public.speaking_format_votes enable row level security;

drop policy if exists "speaking_votes_select" on public.speaking_format_votes;
create policy "speaking_votes_select" on public.speaking_format_votes
  for select to authenticated
  using (true);

drop policy if exists "speaking_votes_write_own" on public.speaking_format_votes;
create policy "speaking_votes_write_own" on public.speaking_format_votes
  for all to authenticated
  using (student_id = public.my_student_id())
  with check (student_id = public.my_student_id());

grant select, insert, update, delete on table public.speaking_format_votes to authenticated;
