import { Button } from '@/components/ui/Button';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useAuth } from '@/context/AuthContext';

/** Compact banner to enable lock-screen push alerts. */
export function PushEnableBanner() {
  const { profile, isActive } = useAuth();
  const push = usePushRegistration(profile?.id, isActive);

  if (!isActive || !push.supported || push.isRegistered) return null;

  return (
    <div className="rounded-md border border-club/40 bg-club-soft/60 px-4 py-3">
      <p className="text-sm font-semibold text-ink">Turn on phone alerts</p>
      <p className="mt-1 text-xs text-ink-subtle">
        Get notified when teachers post work or students submit — even if the app is closed.
      </p>
      <Button
        size="sm"
        className="mt-3"
        loading={push.subscribing}
        onClick={() => void push.enable()}
      >
        Enable notifications
      </Button>
      {push.error && <p className="mt-2 text-xs text-danger">{push.error}</p>}
    </div>
  );
}
