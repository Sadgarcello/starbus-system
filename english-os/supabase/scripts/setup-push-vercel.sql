-- Point Khawaja Club push dispatch at Vercel (not Supabase Edge).
-- Run in Supabase SQL Editor after setting Vercel env vars.
-- Replace YOUR_PUSH_DISPATCH_SECRET with the same value as PUSH_DISPATCH_SECRET on Vercel.

insert into private.push_dispatch_config (id, functions_base_url, dispatch_secret)
values (
  1,
  'https://english-os-livid.vercel.app/api',
  'YOUR_PUSH_DISPATCH_SECRET'
)
on conflict (id) do update set
  functions_base_url = excluded.functions_base_url,
  dispatch_secret = excluded.dispatch_secret,
  updated_at = now();

-- Verify
select functions_base_url, dispatch_secret is not null as has_secret
from private.push_dispatch_config
where id = 1;
