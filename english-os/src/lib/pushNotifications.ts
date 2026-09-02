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
    if (existing) {
      void existing.update();
      return existing;
    }
    const reg = await navigator.serviceWorker.register(SW_SCRIPT, {
      scope: SW_SCOPE,
      updateViaCache: 'none',
    });
    void reg.update();
    return reg;
  } catch {
    return null;
  }
}

/** Current browser push endpoint, if subscribed locally. */
export async function getLocalPushEndpoint(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const subscription = await registration?.pushManager.getSubscription();
    return subscription?.endpoint ?? null;
  } catch {
    return null;
  }
}

/** True when THIS browser is registered (local subscription + saved row). */
export async function isThisDeviceRegistered(): Promise<boolean> {
  const endpoint = await getLocalPushEndpoint();
  if (!endpoint) return false;

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

/** @deprecated Use isThisDeviceRegistered — counts any device on the account. */
export async function hasPushSubscription(): Promise<boolean> {
  return isThisDeviceRegistered();
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

/** Show a notification immediately via the service worker (no server push). */
export async function showLocalNotification(
  title: string,
  body: string,
): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission !== 'granted') return 'denied';

  const registration = await getServiceWorkerRegistration();
  if (!registration) return 'unsupported';

  await registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `local-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: { url: '/notifications' },
  } as NotificationOptions);

  return 'ok';
}
