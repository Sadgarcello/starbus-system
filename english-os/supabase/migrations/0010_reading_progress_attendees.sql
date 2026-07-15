-- ============================================================================
-- 0010_reading_progress_attendees.sql
-- When teacher declares pages finished, reading % applies only to students
-- who marked attendance that day.
-- ============================================================================

alter table public.students
  add column if not exists reading_progress integer not null default 0
    check (reading_progress >= 0 and reading_progress <= 100);

create or replace function public.apply_reading_progress_to_attendees(
  p_book_id uuid,
  p_session_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  book public.reading_books%rowtype;
  pct integer;
  updated_count integer := 0;
begin
  if not public.is_teacher() then
    raise exception 'insufficient_privilege';
  end if;

  select * into book from public.reading_books where id = p_book_id;
  if book.id is null then
    raise exception 'book_not_found';
  end if;

  if book.total_pages <= 0 then
    raise exception 'invalid_total_pages';
  end if;

  pct := least(100, greatest(0, round((book.pages_finished::numeric / book.total_pages::numeric) * 100)));

  update public.students s
  set reading_progress = pct
  where s.id in (
    select m.student_id
    from public.attendance_marks m
    join public.attendance_sessions sess on sess.id = m.session_id
    where sess.session_date = p_session_date
  );

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.apply_reading_progress_to_attendees(uuid, date) to authenticated;
