-- ============================================================================
-- 0015_notification_test.sql
-- Admin-only test notifications (same pipeline as production → push-ready).
-- Run after 0014 in the Supabase SQL Editor.
-- ============================================================================

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
    cfg.functions_base_url is not null and cfg.dispatch_secret is not null,
    'has_functions_url', cfg.functions_base_url is not null,
    'has_dispatch_secret', cfg.dispatch_secret is not null
  );
end;
$$;

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
    perform public.notify_users(
      recipient_ids,
      test_type,
      test_title,
      test_body,
      test_link,
      jsonb_build_object('is_test', true, 'scenario', p_scenario)
    );
  end if;

  return jsonb_build_object(
    'scenario', p_scenario,
    'type', test_type,
    'audience', audience_label,
    'sent_count', sent_count
  );
end;
$$;

create or replace function public.admin_send_all_test_notifications()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  scenarios text[] := array[
    'registration',
    'content_writing',
    'content_speaking',
    'content_reading',
    'assignment',
    'submission_writing',
    'submission_assignment',
    'submission_listening'
  ];
  scenario text;
  result jsonb;
  results jsonb := '[]'::jsonb;
  total_sent int := 0;
begin
  if not public.is_admin() then
    raise exception 'insufficient_privilege';
  end if;

  foreach scenario in array scenarios loop
    result := public.admin_send_test_notification(scenario);
    results := results || jsonb_build_array(result);
    total_sent := total_sent + coalesce((result->>'sent_count')::int, 0);
  end loop;

  return jsonb_build_object(
    'total_sent', total_sent,
    'scenario_count', array_length(scenarios, 1),
    'results', results
  );
end;
$$;

grant execute on function public.admin_push_dispatch_status() to authenticated;
grant execute on function public.admin_send_test_notification(text) to authenticated;
grant execute on function public.admin_send_all_test_notifications() to authenticated;
