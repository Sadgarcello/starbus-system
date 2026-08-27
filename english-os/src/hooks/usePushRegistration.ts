import { useCallback, useEffect, useState } from 'react';
import {
  ensureServiceWorker,
  hasPushSubscription,
  isPushSupported,
  pushPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';

export function usePushRegistration(userId: string | undefined, enabled = true) {
  const [permission, setPermission] = useState(() => pushPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPermission(pushPermission());
    if (!userId) {
      setSubscribed(false);
      return;
    }
    setSubscribed(await hasPushSubscription());
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId) return;
    void ensureServiceWorker();
    void refresh();
  }, [enabled, userId, refresh]);

  async function enable() {
    if (!userId) return;
    setSubscribing(true);
    setError(null);
    try {
      const result = await subscribeToPush(userId);
      await refresh();
      if (!result.ok) {
        if (result.reason === 'denied') {
          setError('Notifications blocked. Open Android Settings → Apps → Chrome → Notifications → Allow.');
        } else if (result.reason === 'unsupported') {
          setError('Push is not supported in this browser. Use Chrome on Android.');
        } else {
          setError(result.message ?? 'Could not register this device for push.');
        }
      }
    } catch (e) {
      setError((e as Error).message || 'Failed to enable notifications');
    } finally {
      setSubscribing(false);
    }
  }

  async function disable() {
    setSubscribing(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      await refresh();
    } catch (e) {
      setError((e as Error).message || 'Failed to disable notifications');
    } finally {
      setSubscribing(false);
    }
  }

  const permissionGranted = permission === 'granted';
  const isRegistered = permissionGranted && subscribed;

  return {
    supported: isPushSupported(),
    permission,
    subscribed,
    subscribing,
    error,
    enable,
    disable,
    refresh,
    permissionGranted,
    isRegistered,
    isEnabled: isRegistered,
  };
}
