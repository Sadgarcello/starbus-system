-- ============================================================================
-- 0014_notifications_push.sql
-- In-app notifications + Web Push subscriptions + event triggers
-- Run after 0013. Configure push dispatch after deploy (see README).
-- ============================================================================

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null,
  link_path  text,
  metadata   jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- Edge function dispatch config (single row; set after deploy)
create schema if not exists private;

create table if not exists private.push_dispatch_config (
  id                 int primary key default 1 check (id = 1),
  functions_base_url text,
  dispatch_secret    text,
  updated_at         timestamptz not null default now()
);

revoke all on schema private from public;
revoke all on private.push_dispatch_config from public;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.active_admin_ids()
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.profiles
  where role = 'admin'
    and status = 'active'
    and coalesce(is_locked, false) = false;
$$;

create or replace function public.active_teacher_ids()
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.profiles
  where role in ('admin', 'teacher')
    and status = 'active'
    and coalesce(is_locked, false) = false;
$$;

create or replace function public.active_student_user_ids()
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profiles p
  inner join public.students s on s.user_id = p.id
  where p.role = 'student'
    and p.status = 'active'
    and coalesce(p.is_locked, false) = false;
$$;

create or replace function public.notify_users(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_link_path text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return;
  end if;

  foreach uid in array p_user_ids loop
    insert into public.notifications (user_id, type, title, body, link_path, metadata)
    values (uid, p_type, p_title, p_body, p_link_path, p_metadata);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Push dispatch (pg_net → Edge Function)
-- ---------------------------------------------------------------------------

create or replace function private.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  cfg private.push_dispatch_config%rowtype;
begin
  select * into cfg from private.push_dispatch_config where id = 1;

  if cfg.functions_base_url is null or cfg.dispatch_secret is null then
    return NEW;
  end if;

  perform net.http_post(
    url := rtrim(cfg.functions_base_url, '/') || '/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Push-Dispatch-Secret', cfg.dispatch_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)::jsonb
  );

  return NEW;
exception
  when others then
    return NEW;
end;
$$;

drop trigger if exists trg_dispatch_push_notification on public.notifications;
create trigger trg_dispatch_push_notification
  after insert on public.notifications
  for each row
  execute function private.dispatch_push_notification();

-- ---------------------------------------------------------------------------
-- Event triggers
-- ---------------------------------------------------------------------------

create or replace function public.trg_notify_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  label text;
begin
  if NEW.status = 'pending'::account_status then
    label := coalesce(NEW.name, NEW.email, 'Someone');
    perform public.notify_users(
      public.active_admin_ids(),
      'registration',
      'New join request',
      label || ' asked to join Khawaja Club.',
      '/approvals',
      jsonb_build_object('profile_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_profiles_notify_registration on public.profiles;
create trigger trg_profiles_notify_registration
  after insert on public.profiles
  for each row
  execute function public.trg_notify_registration();

create or replace function public.trg_notify_writing_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'open' then
    perform public.notify_users(
      public.active_student_user_ids(),
      'content_writing',
      'New writing task',
      NEW.title || ' is open.',
      '/writing',
      jsonb_build_object('task_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_writing_tasks_notify on public.writing_tasks;
create trigger trg_writing_tasks_notify
  after insert on public.writing_tasks
  for each row
  execute function public.trg_notify_writing_task();

create or replace function public.trg_notify_speaking_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fmt_title text;
begin
  if NEW.status = 'open'
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'open') then
    select title into fmt_title from public.speaking_formats where id = NEW.format_id;
    perform public.notify_users(
      public.active_student_user_ids(),
      'content_speaking',
      'Speaking topic is live',
      coalesce(fmt_title, 'Today''s speaking topic') || ' is open.',
      '/speaking',
      jsonb_build_object('session_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_speaking_sessions_notify on public.speaking_day_sessions;
create trigger trg_speaking_sessions_notify
  after insert or update on public.speaking_day_sessions
  for each row
  execute function public.trg_notify_speaking_open();

create or replace function public.trg_notify_reading_book()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_users(
    public.active_student_user_ids(),
    'content_reading',
    'New reading book',
    NEW.title || ' was added to the library.',
    '/reading',
    jsonb_build_object('book_id', NEW.id)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_reading_books_notify on public.reading_books;
create trigger trg_reading_books_notify
  after insert on public.reading_books
  for each row
  execute function public.trg_notify_reading_book();

create or replace function public.trg_notify_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  act_title text;
  act_type text;
begin
  select s.user_id, a.title, a.type::text
    into uid, act_title, act_type
  from public.students s
  inner join public.activities a on a.id = NEW.activity_id
  where s.id = NEW.student_id;

  if uid is not null then
    perform public.notify_users(
      array[uid],
      'assignment',
      'New activity assigned',
      act_title || ' (' || act_type || ')',
      '/assignments/' || NEW.id::text,
      jsonb_build_object('assignment_id', NEW.id, 'activity_type', act_type)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_assignments_notify on public.assignments;
create trigger trg_assignments_notify
  after insert on public.assignments
  for each row
  execute function public.trg_notify_assignment();

create or replace function public.trg_notify_writing_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_title text;
  student_name text;
begin
  select wt.title, coalesce(p.name, p.email, 'A student')
    into task_title, student_name
  from public.writing_tasks wt
  inner join public.students s on s.id = NEW.student_id
  inner join public.profiles p on p.id = s.user_id
  where wt.id = NEW.task_id;

  perform public.notify_users(
    public.active_teacher_ids(),
    'submission_writing',
    'Writing submitted',
    student_name || ' submitted: ' || coalesce(task_title, 'writing task'),
    '/writing',
    jsonb_build_object('submission_id', NEW.id, 'task_id', NEW.task_id)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_writing_submissions_notify on public.writing_submissions;
create trigger trg_writing_submissions_notify
  after insert on public.writing_submissions
  for each row
  execute function public.trg_notify_writing_submission();

create or replace function public.trg_notify_assignment_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  act_title text;
  student_name text;
  assignment_id uuid;
begin
  select a.id, act.title, coalesce(p.name, p.email, 'A student')
    into assignment_id, act_title, student_name
  from public.assignments a
  inner join public.activities act on act.id = a.activity_id
  inner join public.students s on s.id = NEW.student_id
  inner join public.profiles p on p.id = s.user_id
  where a.id = NEW.assignment_id;

  perform public.notify_users(
    public.active_teacher_ids(),
    'submission_assignment',
    'Assignment submitted',
    student_name || ' submitted: ' || coalesce(act_title, 'activity'),
    '/assignments/' || assignment_id::text,
    jsonb_build_object('submission_id', NEW.id, 'assignment_id', assignment_id)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_submissions_notify on public.submissions;
create trigger trg_submissions_notify
  after insert on public.submissions
  for each row
  execute function public.trg_notify_assignment_submission();

create or replace function public.trg_notify_listening_pick()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_name text;
begin
  select coalesce(p.name, p.email, 'A student')
    into student_name
  from public.students s
  inner join public.profiles p on p.id = s.user_id
  where s.id = NEW.student_id;

  perform public.notify_users(
    public.active_teacher_ids(),
    'submission_listening',
    'New listening pick',
    student_name || ' shared: ' || coalesce(NEW.clip_name, 'a clip'),
    '/listening',
    jsonb_build_object('pick_id', NEW.id)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_listening_picks_notify on public.listening_picks;
create trigger trg_listening_picks_notify
  after insert on public.listening_picks
  for each row
  execute function public.trg_notify_listening_pick();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

grant select, update on table public.notifications to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

-- Realtime for in-app bell
alter publication supabase_realtime add table public.notifications;
