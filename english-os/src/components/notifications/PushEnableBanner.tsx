import { Button } from '@/components/ui/Button';
import {
  getDeviceKind,
  getDeviceLabel,
  getNotificationSetupCopy,
  isStandalonePwa,
} from '@/lib/deviceContext';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useAuth } from '@/context/AuthContext';

/** Compact banner to enable push on this device only. */
export function PushEnableBanner() {
  const { profile, isActive } = useAuth();
  const push = usePushRegistration(profile?.id, isActive);
  const copy = getNotificationSetupCopy();
  const needsIosInstall = getDeviceKind() === 'ios' && !isStandalonePwa();

  if (!isActive || !push.supported || push.isRegistered) return null;

  return (
    <div className="rounded-md border border-club/40 bg-club-soft/60 px-4 py-3">
      <p className="text-sm font-semibold text-ink">Turn on alerts on {getDeviceLabel()}</p>
      <p className="mt-1 text-xs text-ink-subtle">{copy.alertsSubtitle}</p>
      {needsIosInstall && copy.setupSteps && (
        <ol className="mt-2 list-inside list-decimal space-y-0.5 text-xs text-ink-muted">
          {copy.setupSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {!needsIosInstall && (
        <Button
          size="sm"
          className="mt-3"
          loading={push.subscribing}
          onClick={() => void push.enable()}
        >
          {copy.enableLabel}
        </Button>
      )}
      {push.error && <p className="mt-2 text-xs text-danger">{push.error}</p>}
    </div>
  );
}
