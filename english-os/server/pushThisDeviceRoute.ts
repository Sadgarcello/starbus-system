import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPushEnv, sendPushToSubscriptions, verifySupabaseAccessToken } from './pushSend.js';

/** Admin-only: push directly to the caller's registered devices (bypasses pg_net). */
export async function handlePushThisDevice(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const env = getPushEnv();
  if (!env.ok) {
    return res.status(500).json({ error: env.error });
  }

  const authHeader = req.headers.authorization;
  const bodyToken =
    typeof req.body === 'object' && req.body && 'access_token' in req.body
      ? String((req.body as { access_token?: string }).access_token ?? '')
      : '';

  const token = (
    authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : bodyToken
  ).trim();

  if (!token) {
    return res.status(401).json({ error: 'missing_auth' });
  }

  const apiKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    env.serviceRoleKey;

  const user = await verifySupabaseAccessToken(env.supabaseUrl, apiKey, token);

  if (!user) {
    return res.status(401).json({
      error: 'invalid_auth',
      detail: 'Token rejected — sign out and sign in again, then retry.',
    });
  }

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey);

  const { data: profile } = await admin
    .from('profiles')
    .select('role, status, is_locked')
    .eq('id', user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== 'admin' ||
    profile.status !== 'active' ||
    profile.is_locked === true
  ) {
    return res.status(403).json({ error: 'admin_only' });
  }

  const { data: subscriptions, error: subError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id);

  if (subError) {
    return res.status(500).json({ error: subError.message });
  }

  if (!subscriptions?.length) {
    return res.status(200).json({
      sent: 0,
      failed: 0,
      skipped: 'no_subscriptions',
      hint: 'Open Notifications on this phone and tap Enable phone alerts first.',
    });
  }

  const result = await sendPushToSubscriptions(
    subscriptions,
    {
      title: '🧪 Khawaja Club — push test',
      body: 'If you see this on your lock screen, phone push is working.',
      url: '/notifications',
      tag: 'push-device-test',
    },
    {
      subject: env.vapidSubject,
      publicKey: env.vapidPublic,
      privateKey: env.vapidPrivate,
    },
  );

  if (result.staleIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', result.staleIds);
  }

  return res.status(200).json({
    sent: result.sent,
    failed: result.failed,
    stale_removed: result.stale_removed,
    errors: result.errors,
    subscription_count: subscriptions.length,
  });
}
