import { useEffect, useState } from 'react';
import {
  ensureServiceWorker,
  isPushSupported,
  pushPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';

export function usePushRegistration(userId: string | undefined, enabled = true) {
  const [permission, setPermission] = useState(() => pushPermission());
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return;
    void ensureServiceWorker();
  }, [enabled, userId]);

  async function enable() {
    if (!userId) return;
    setSubscribing(true);
    setError(null);
    try {
      const result = await subscribeToPush(userId);
      setPermission(pushPermission());
      if (result === 'denied') {
        setError('Notifications blocked. Enable them in your browser or phone settings.');
      } else if (result === 'error') {
        setError('Could not enable push. Check VITE_VAPID_PUBLIC_KEY is set.');
      } else if (result === 'unsupported') {
        setError('Push notifications are not supported on this device.');
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
      setPermission(pushPermission());
    } catch (e) {
      setError((e as Error).message || 'Failed to disable notifications');
    } finally {
      setSubscribing(false);
    }
  }

  return {
    supported: isPushSupported(),
    permission,
    subscribing,
    error,
    enable,
    disable,
    isEnabled: permission === 'granted',
  };
}
