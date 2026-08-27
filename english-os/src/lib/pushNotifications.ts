import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

const SW_SCRIPT = '/sw.js';
const SW_SCOPE = '/';

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i);
  }
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

export function isPushSupported(): boolean {
  return (
    isSupabaseConfigured &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_SCRIPT, { scope: SW_SCOPE });
  } catch {
    return null;
  }
}

/** True when this browser has a row in push_subscriptions for the logged-in user. */
export async function hasPushSubscription(): Promise<boolean> {
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true });
  if (error) return false;
  return (count ?? 0) > 0;
}

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no_vapid' | 'no_sw' | 'save_failed'; message?: string };

export async function subscribeToPush(userId: string): Promise<PushSubscribeResult> {
  if (!isPushSupported()) {
    return { ok: false, reason: 'unsupported' };
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    return { ok: false, reason: 'no_vapid', message: 'VITE_VAPID_PUBLIC_KEY is missing.' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { ok: false, reason: 'no_sw', message: 'Could not register the service worker.' };
  }

  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: 'save_failed', message: 'Push subscription was incomplete.' };
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 500),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    return { ok: false, reason: 'save_failed', message: error.message };
  }

  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

export async function ensureServiceWorker(): Promise<void> {
  if (!isPushSupported()) return;
  await getServiceWorkerRegistration();
}
