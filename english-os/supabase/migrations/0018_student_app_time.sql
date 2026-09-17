-- 0018_student_app_time.sql
-- Track total active time in the app (seconds), updated by students while signed in.

alter table public.students
  add column if not exists app_time_seconds bigint not null default 0
  check (app_time_seconds >= 0);

create or replace function public.record_student_app_time(p_seconds int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if p_seconds is null or p_seconds < 1 or p_seconds > 300 then
    return;
  end if;

  sid := public.my_student_id();
  if sid is null then
    return;
  end if;

  update public.students
  set app_time_seconds = app_time_seconds + p_seconds
  where id = sid;
end;
$$;

grant execute on function public.record_student_app_time(int) to authenticated;
