-- Run in Supabase SQL Editor to verify notification setup

-- 1) Tables exist
select to_regclass('public.notifications') as notifications_table;
select to_regclass('public.push_subscriptions') as push_subscriptions_table;

-- 2) Recent notifications (should show rows after a fake signup)
select id, user_id, type, title, body, created_at
from public.notifications
order by created_at desc
limit 10;

-- 3) Registration trigger attached
select tgname
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and tgname = 'trg_profiles_notify_registration';

-- 4) Push dispatch configured (needed for lock-screen popups)
select
  functions_base_url is not null as has_url,
  dispatch_secret is not null as has_secret
from private.push_dispatch_config
where id = 1;

-- 5) Devices subscribed for push
select user_id, left(endpoint, 40) as endpoint_prefix, created_at
from public.push_subscriptions
order by created_at desc
limit 10;
