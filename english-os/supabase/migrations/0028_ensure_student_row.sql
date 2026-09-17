-- ============================================================================
-- 0028_ensure_student_row.sql
-- Prevents not_a_student: active student profiles always get a students row.
-- Also backfills any existing gaps (e.g. manual role edits in Supabase UI).
-- ============================================================================

insert into public.students (user_id, level)
select p.id, 'A1'
from public.profiles p
left join public.students s on s.user_id = p.id
where p.role = 'student'
  and p.status = 'active'
  and s.id is null
on conflict (user_id) do nothing;

create or replace function public.ensure_student_row_for_active_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'student' and new.status = 'active' then
    insert into public.students (user_id, level)
    values (new.id, 'A1')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_student_row on public.profiles;
create trigger trg_ensure_student_row
  after insert or update of role, status on public.profiles
  for each row
  execute function public.ensure_student_row_for_active_student();
