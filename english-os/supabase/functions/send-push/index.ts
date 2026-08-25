import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-dispatch-secret',
};

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET');
  const headerSecret = req.headers.get('X-Push-Dispatch-Secret');

  if (!dispatchSecret || headerSecret !== dispatchSecret) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@khawajaclub.app';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    return jsonResponse({ error: 'missing_env' }, 500);
  }

  let payload: PushPayload;
  try {
    payload = (await req.json()) as PushPayload;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  if (!payload.notification_id) {
    return jsonResponse({ error: 'notification_id_required' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: notification, error: notifError } = await admin
    .from('notifications')
    .select('id, user_id, title, body, link_path')
    .eq('id', payload.notification_id)
    .maybeSingle();

  if (notifError) {
    return jsonResponse({ error: notifError.message }, 500);
  }

  if (!notification) {
    return jsonResponse({ error: 'notification_not_found' }, 404);
  }

  const row = notification as NotificationRow;

  const { data: subscriptions, error: subError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', row.user_id);

  if (subError) {
    return jsonResponse({ error: subError.message }, 500);
  }

  const subs = (subscriptions ?? []) as SubscriptionRow[];
  if (subs.length === 0) {
    return jsonResponse({ sent: 0, skipped: 'no_subscriptions' });
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

  return jsonResponse({ sent, stale_removed: staleIds.length });
});
