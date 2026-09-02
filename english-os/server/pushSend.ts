import webpush from 'web-push';

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSendResult {
  sent: number;
  stale_removed: number;
  failed: number;
  errors: string[];
  staleIds: string[];
}

export function getPushEnv() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@khawajaclub.app';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    return { ok: false as const, error: 'missing_env' as const };
  }

  return {
    ok: true as const,
    supabaseUrl,
    serviceRoleKey,
    vapidPublic,
    vapidPrivate,
    vapidSubject,
  };
}

export async function sendPushToSubscriptions(
  subs: PushSubscriptionRow[],
  payload: { title: string; body: string; url: string; tag: string },
  vapid: { subject: string; publicKey: string; privateKey: string },
): Promise<PushSendResult> {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const pushBody = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];
  const errors: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushBody,
          { TTL: 60 * 60 * 24, urgency: 'high' },
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = (err as { statusCode?: number }).statusCode;
        const body = (err as { body?: string }).body;
        const msg = `status=${status ?? '?'} ${body ?? (err as Error).message ?? 'push failed'}`;
        errors.push(msg.slice(0, 240));
        if (status === 404 || status === 410) {
          staleIds.push(sub.id);
        }
      }
    }),
  );

  return { sent, stale_removed: staleIds.length, failed, errors, staleIds };
}

/** Validate a user access token via Supabase Auth HTTP API (reliable on Vercel). */
export async function verifySupabaseAccessToken(
  supabaseUrl: string,
  apiKey: string,
  accessToken: string,
): Promise<{ id: string; email?: string } | null> {
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: apiKey,
      },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string; email?: string };
    if (!user?.id) return null;
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}
