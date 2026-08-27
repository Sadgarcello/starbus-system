-- 0016_push_dispatch_fix.sql — trim secrets, log pg_net, return notification ids from tests

create or replace function private.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  cfg private.push_dispatch_config%rowtype;
  req_id bigint;
  secret text;
  base_url text;
begin
  select * into cfg from private.push_dispatch_config where id = 1;

  secret := nullif(trim(cfg.dispatch_secret), '');
  base_url := nullif(trim(cfg.functions_base_url), '');

  if base_url is null or secret is null then
    return NEW;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Push-Dispatch-Secret', secret
    ),
    body := jsonb_build_object('notification_id', NEW.id::text)
  ) into req_id;

  return NEW;
exception
  when others then
    raise warning 'push dispatch failed for notification %: %', NEW.id, SQLERRM;
    return NEW;
end;
$$;

-- Return created notification ids so the app can relay push if pg_net fails
create or replace function public.admin_send_test_notification(p_scenario text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  test_title text;
  test_body text;
  test_type text;
  test_link text;
  recipient_ids uuid[];
  audience_label text;
  sent_count int;
  created_ids uuid[] := '{}'::uuid[];
  uid uuid;
  nid uuid;
begin
  if not public.is_admin() then
    raise exception 'insufficient_privilege';
  end if;

  test_body := 'This is a test notification from Khawaja Club admin. No action needed — please ignore.';

  case p_scenario
    when 'registration' then
      test_type := 'registration';
      test_title := '🧪 TEST — New join request';
      test_link := '/approvals';
      recipient_ids := public.active_admin_ids();
      audience_label := 'admins';
    when 'content_writing' then
      test_type := 'content_writing';
      test_title := '🧪 TEST — New writing task';
      test_link := '/writing';
      recipient_ids := public.active_student_user_ids();
      audience_label := 'students';
    when 'content_speaking' then
      test_type := 'content_speaking';
      test_title := '🧪 TEST — Speaking topic is live';
      test_link := '/speaking';
      recipient_ids := public.active_student_user_ids();
      audience_label := 'students';
    when 'content_reading' then
      test_type := 'content_reading';
      test_title := '🧪 TEST — New reading book';
      test_link := '/reading';
      recipient_ids := public.active_student_user_ids();
      audience_label := 'students';
    when 'assignment' then
      test_type := 'assignment';
      test_title := '🧪 TEST — New activity assigned';
      test_link := '/dashboard';
      recipient_ids := public.active_student_user_ids();
      audience_label := 'students';
    when 'submission_writing' then
      test_type := 'submission_writing';
      test_title := '🧪 TEST — Writing submitted';
      test_link := '/writing';
      recipient_ids := public.active_teacher_ids();
      audience_label := 'teachers';
    when 'submission_assignment' then
      test_type := 'submission_assignment';
      test_title := '🧪 TEST — Assignment submitted';
      test_link := '/dashboard';
      recipient_ids := public.active_teacher_ids();
      audience_label := 'teachers';
    when 'submission_listening' then
      test_type := 'submission_listening';
      test_title := '🧪 TEST — New listening pick';
      test_link := '/listening';
      recipient_ids := public.active_teacher_ids();
      audience_label := 'teachers';
    else
      raise exception 'unknown_test_scenario: %', p_scenario;
  end case;

  sent_count := coalesce(array_length(recipient_ids, 1), 0);

  if sent_count > 0 then
    foreach uid in array recipient_ids loop
      insert into public.notifications (user_id, type, title, body, link_path, metadata)
      values (
        uid,
        test_type,
        test_title,
        test_body,
        test_link,
        jsonb_build_object('is_test', true, 'scenario', p_scenario)
      )
      returning id into nid;
      created_ids := array_append(created_ids, nid);
    end loop;
  end if;

  return jsonb_build_object(
    'scenario', p_scenario,
    'type', test_type,
    'audience', audience_label,
    'sent_count', sent_count,
    'notification_ids', to_jsonb(created_ids)
  );
end;
$$;

create or replace function public.admin_push_dispatch_status()
returns jsonb
language plpgsql
security definer
set search_path = public, private
stable
as $$
declare
  cfg private.push_dispatch_config%rowtype;
begin
  if not public.is_admin() then
    raise exception 'insufficient_privilege';
  end if;

  select * into cfg from private.push_dispatch_config where id = 1;

  return jsonb_build_object(
    'push_configured',
    nullif(trim(cfg.functions_base_url), '') is not null
      and nullif(trim(cfg.dispatch_secret), '') is not null,
    'has_functions_url', nullif(trim(cfg.functions_base_url), '') is not null,
    'has_dispatch_secret', nullif(trim(cfg.dispatch_secret), '') is not null,
    'functions_base_url', nullif(trim(cfg.functions_base_url), '')
  );
end;
$$;
