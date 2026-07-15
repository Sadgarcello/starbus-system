-- ============================================================================
-- 0008_reading_books.sql
-- Novel/book covers, page progress %, student votes for which to start first.
-- Run after 0001–0007 in Khawaja Club DB SQL Editor.
-- ============================================================================

create table if not exists public.reading_books (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author          text,
  cover_path      text,
  total_pages     integer not null check (total_pages > 0),
  pages_finished  integer not null default 0 check (pages_finished >= 0),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (pages_finished <= total_pages)
);

create table if not exists public.reading_book_votes (
  student_id  uuid primary key references public.students (id) on delete cascade,
  book_id     uuid not null references public.reading_books (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_reading_votes_book
  on public.reading_book_votes (book_id);

create or replace function public.vote_reading_book(p_book_id uuid)
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

  if not exists (select 1 from public.reading_books where id = p_book_id) then
    raise exception 'book_not_found';
  end if;

  insert into public.reading_book_votes (student_id, book_id, updated_at)
  values (sid, p_book_id, now())
  on conflict (student_id) do update
    set book_id = excluded.book_id,
        updated_at = now();
end;
$$;

create or replace function public.clear_reading_vote()
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
  delete from public.reading_book_votes where student_id = sid;
end;
$$;

grant execute on function public.vote_reading_book(uuid) to authenticated;
grant execute on function public.clear_reading_vote() to authenticated;

-- Covers bucket ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('reading-covers', 'reading-covers', false)
on conflict (id) do nothing;

drop policy if exists "reading_covers_select" on storage.objects;
create policy "reading_covers_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'reading-covers');

drop policy if exists "reading_covers_write_teacher" on storage.objects;
create policy "reading_covers_write_teacher" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reading-covers'
    and public.is_teacher()
  );

drop policy if exists "reading_covers_update_teacher" on storage.objects;
create policy "reading_covers_update_teacher" on storage.objects
  for update to authenticated
  using (bucket_id = 'reading-covers' and public.is_teacher())
  with check (bucket_id = 'reading-covers' and public.is_teacher());

drop policy if exists "reading_covers_delete_teacher" on storage.objects;
create policy "reading_covers_delete_teacher" on storage.objects
  for delete to authenticated
  using (bucket_id = 'reading-covers' and public.is_teacher());

-- RLS -------------------------------------------------------------------------
alter table public.reading_books enable row level security;
alter table public.reading_book_votes enable row level security;

drop policy if exists "reading_books_select" on public.reading_books;
create policy "reading_books_select" on public.reading_books
  for select to authenticated using (true);

drop policy if exists "reading_books_write_teacher" on public.reading_books;
create policy "reading_books_write_teacher" on public.reading_books
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "reading_votes_select" on public.reading_book_votes;
create policy "reading_votes_select" on public.reading_book_votes
  for select to authenticated using (true);

drop policy if exists "reading_votes_write_own" on public.reading_book_votes;
create policy "reading_votes_write_own" on public.reading_book_votes
  for all to authenticated
  using (student_id = public.my_student_id())
  with check (student_id = public.my_student_id());

grant select, insert, update, delete on table public.reading_books to authenticated;
grant select, insert, update, delete on table public.reading_book_votes to authenticated;
