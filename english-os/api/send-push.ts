import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPushEnv, sendPushToSubscriptions } from './lib/pushSend.js';

interface PushPayload {
  notification_id?: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link_path: string | null;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-push-dispatch-secret');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const dispatchSecret = process.env.PUSH_DISPATCH_SECRET?.trim();
  const headerSecret = String(req.headers['x-push-dispatch-secret'] ?? '').trim();

  if (!dispatchSecret || headerSecret !== dispatchSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const env = getPushEnv();
  if (!env.ok) {
    return res.status(500).json({ error: env.error });
  }

  const payload = req.body as PushPayload;
  if (!payload?.notification_id) {
    return res.status(400).json({ error: 'notification_id_required' });
  }

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey);

  const { data: notification, error: notifError } = await admin
    .from('notifications')
    .select('id, user_id, title, body, link_path')
    .eq('id', payload.notification_id)
    .maybeSingle();

  if (notifError) {
    return res.status(500).json({ error: notifError.message });
  }

  if (!notification) {
    return res.status(404).json({ error: 'notification_not_found' });
  }

  const row = notification as NotificationRow;

  const { data: subscriptions, error: subError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', row.user_id);

  if (subError) {
    return res.status(500).json({ error: subError.message });
  }

  const subs = (subscriptions ?? []) as SubscriptionRow[];
  if (subs.length === 0) {
    return res.status(200).json({ sent: 0, skipped: 'no_subscriptions', failed: 0, errors: [] });
  }

  const result = await sendPushToSubscriptions(
    subs,
    {
      title: row.title,
      body: row.body,
      url: row.link_path ?? '/',
      tag: row.id,
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
  });
}
