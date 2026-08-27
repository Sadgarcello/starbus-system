import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { NOTIFICATION_TEST_SCENARIOS } from '@/lib/notificationTestScenarios';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notificationService';
import type { NotificationTestScenario, PushDispatchStatus } from '@/types';

export function NotificationTestPanel() {
  const { profile } = useAuth();
  const push = usePushRegistration(profile?.id, Boolean(profile));
  const [pushStatus, setPushStatus] = useState<PushDispatchStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [running, setRunning] = useState<NotificationTestScenario | 'all' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    void notificationService
      .pushDispatchStatus()
      .then(setPushStatus)
      .catch((e) => setStatusError((e as Error).message || 'Could not load push status'));
  }, []);

  async function runScenario(scenario: NotificationTestScenario) {
    setRunning(scenario);
    setFeedback(null);
    setFeedbackError(null);
    try {
      const result = await notificationService.sendTest(scenario);
      if (result.sent_count === 0) {
        setFeedback(
          `Test sent for “${labelFor(scenario)}”, but no active ${result.audience} were found.`,
        );
      } else {
        setFeedback(
          `Test sent to ${result.sent_count} ${result.audience}. They will see “TEST — no action needed”.`,
        );
      }
    } catch (e) {
      setFeedbackError((e as Error).message || 'Test failed');
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    const ok = window.confirm(
      'Send all 8 test notifications now?\n\nEveryone in each group (admins, students, teachers) will receive a TEST alert. No action is required from them.',
    );
    if (!ok) return;

    setRunning('all');
    setFeedback(null);
    setFeedbackError(null);
    try {
      const result = await notificationService.sendAllTests();
      setFeedback(
        `All tests sent — ${result.total_sent} notification(s) delivered across admins, students, and teachers.`,
      );
    } catch (e) {
      setFeedbackError((e as Error).message || 'Bulk test failed');
    } finally {
      setRunning(null);
    }
  }

  return (
    <Card className="border-club/30">
      <CardHeader
        title="Notification testing"
        subtitle="Admin only — sends real test alerts through the same system as production"
      />

      <div className="space-y-4 px-4 pb-4">
        <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <p className="font-semibold">Test mode</p>
          <p className="mt-1 text-xs leading-relaxed">
            Each alert is prefixed with <strong>TEST</strong> and tells recipients:{' '}
            <em>“No action needed — please ignore.”</em> Use this to verify the bell, browser
            popups, and (when configured) lock-screen push.
          </p>
        </div>

        <PushStatusLine status={pushStatus} error={statusError} />
        <DeviceStatusLine push={push} />

        <ul className="space-y-2">
          {NOTIFICATION_TEST_SCENARIOS.map((scenario) => (
            <li
              key={scenario.id}
              className="flex flex-col gap-2 rounded-md border border-paper-line bg-paper-soft/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{scenario.label}</p>
                <p className="text-xs text-ink-subtle">
                  → {scenario.audience} · {scenario.description}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                loading={running === scenario.id}
                disabled={running !== null}
                onClick={() => void runScenario(scenario.id)}
              >
                Send test
              </Button>
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          loading={running === 'all'}
          disabled={running !== null}
          onClick={() => void runAll()}
        >
          Run all tests
        </Button>

        {feedback && (
          <p className="rounded-md border border-paper-line bg-paper px-3 py-2 text-xs font-medium text-ink">
            {feedback}
          </p>
        )}
        {feedbackError && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {feedbackError}
            {feedbackError.includes('admin_send_test_notification') ||
            feedbackError.includes('Could not find the function') ? (
              <span className="mt-1 block">
                Run migration <code className="text-[11px]">0015_notification_test.sql</code> in
                Supabase SQL Editor, then try again.
              </span>
            ) : null}
          </p>
        )}
      </div>
    </Card>
  );
}

function DeviceStatusLine({
  push,
}: {
  push: ReturnType<typeof usePushRegistration>;
}) {
  if (!push.supported) {
    return (
      <p className="text-xs text-ink-subtle">
        This browser cannot receive lock-screen push. Run tests from Chrome on your Android phone.
      </p>
    );
  }

  if (push.isRegistered) {
    return (
      <p className="text-xs font-semibold text-emerald-700">
        This device: registered — lock-screen tests will hit this phone when the app is closed.
      </p>
    );
  }

  if (push.permissionGranted) {
    return (
      <p className="text-xs text-amber-900">
        This device: not registered — tap <strong>Register this device</strong> on Notifications, then
        send a test again.
      </p>
    );
  }

  return (
    <p className="text-xs text-ink-subtle">
      This device: not set up — open <strong>Notifications</strong> on your Android phone, enable alerts,
      then send a test from there (not from PC).
    </p>
  );
}

function PushStatusLine({
  status,
  error,
}: {
  status: PushDispatchStatus | null;
  error: string | null;
}) {
  if (error) {
    return (
      <p className="text-xs text-ink-subtle">
        Phone push status unavailable
        {error.includes('admin_push_dispatch_status') ||
        error.includes('Could not find the function') ? (
          <> — run migration 0015 first</>
        ) : (
          <> — {error}</>
        )}
      </p>
    );
  }

  if (!status) {
    return <p className="text-xs text-ink-subtle">Checking phone push setup…</p>;
  }

  if (status.push_configured) {
    return (
      <p className="text-xs font-semibold text-emerald-700">
        Phone push: configured — lock-screen alerts will fire for users who enabled notifications.
      </p>
    );
  }

  return (
    <p className="text-xs text-ink-muted">
      Phone push: not configured yet — in-app bell and browser popups still work. Lock-screen alerts
      will work after Vercel env vars + <code className="text-[11px]">push_dispatch_config</code>{' '}
      SQL are set (see README).
    </p>
  );
}

function labelFor(scenario: NotificationTestScenario) {
  return NOTIFICATION_TEST_SCENARIOS.find((s) => s.id === scenario)?.label ?? scenario;
}
