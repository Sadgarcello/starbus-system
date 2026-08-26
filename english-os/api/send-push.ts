import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';

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

  const dispatchSecret = process.env.PUSH_DISPATCH_SECRET;
  const headerSecret = req.headers['x-push-dispatch-secret'];

  if (!dispatchSecret || headerSecret !== dispatchSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@khawajaclub.app';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'missing_env' });
  }

  const payload = req.body as PushPayload;
  if (!payload?.notification_id) {
    return res.status(400).json({ error: 'notification_id_required' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

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
    return res.status(200).json({ sent: 0, skipped: 'no_subscriptions' });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const pushBody = JSON.stringify({
    title: row.title,
    body: row.body,
    url: row.link_path ?? '/',
    tag: row.id,
  });

  let sent = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushBody,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          staleIds.push(sub.id);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', staleIds);
  }

  return res.status(200).json({ sent, stale_removed: staleIds.length });
}
