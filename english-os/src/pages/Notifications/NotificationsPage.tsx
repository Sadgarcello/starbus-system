import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useNotifications } from '@/hooks/useNotifications';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notificationService';
import type { AppNotification } from '@/types';
import { cn } from '@/utils/cn';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const { inbox, unreadCount, markRead, markAllRead } = useNotifications(profile?.id);
  const push = usePushRegistration(profile?.id, Boolean(profile));

  if (inbox.isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Notifications</h1>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            loading={markAllRead.isPending}
            onClick={() => void markAllRead.mutateAsync()}
          >
            Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader
          title="Phone alerts"
          subtitle="Get pop-ups on your lock screen even when Khawaja Club is closed"
        />
        <div className="space-y-3 px-4 py-4">
          {!push.supported ? (
            <p className="text-sm text-ink-subtle">
              Push is not supported in this browser. Install Khawaja Club to your home screen (Safari
              on iPhone, Chrome on Android) for best results.
            </p>
          ) : push.isRegistered ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-ink">This device is registered for lock-screen alerts.</p>
              <Button variant="secondary" size="sm" loading={push.subscribing} onClick={() => void push.disable()}>
                Turn off
              </Button>
            </div>
          ) : push.permissionGranted ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-900">
                Notifications are allowed, but <strong>this phone is not registered yet</strong> (common after
                an update). Tap below to register.
              </p>
              <Button loading={push.subscribing} onClick={() => void push.enable()}>
                Register this device
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-ink-subtle">
                Tap below and choose <strong>Allow</strong> when asked. On iPhone, add Khawaja Club
                to your Home Screen first.
              </p>
              <Button loading={push.subscribing} onClick={() => void push.enable()}>
                Enable phone alerts
              </Button>
            </div>
          )}
          {push.error && <p className="text-xs text-danger">{push.error}</p>}
          {profile?.role === 'admin' && push.isRegistered && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => void notificationService.pushThisDevice().then(
                (r) => {
                  if (r.sent > 0) {
                    alert('Push sent — close the app and check your lock screen.');
                  } else {
                    alert(r.errors?.join('\n') ?? 'Push failed. Try Register this device again.');
                  }
                },
                (e) => alert((e as Error).message),
              )}
            >
              Test lock-screen push now
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Inbox" subtitle={`${unreadCount} unread`} />
        {inbox.data && inbox.data.length > 0 ? (
          <ul className="divide-y divide-paper-line">
            {inbox.data.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onRead={() => void markRead.mutateAsync(item.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-ink-subtle">No notifications yet.</p>
        )}
      </Card>
    </div>
  );
}

function NotificationRow({ item, onRead }: { item: AppNotification; onRead: () => void }) {
  const isUnread = !item.read_at;
  const content = (
    <div className="flex gap-3 px-4 py-3">
      <span
        className={cn(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
          isUnread ? 'bg-club' : 'bg-transparent',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', isUnread ? 'font-bold text-ink' : 'font-medium text-ink/80')}>
          {item.title}
        </p>
        <p className="mt-0.5 text-sm text-ink-subtle">{item.body}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-subtle">
          {formatWhen(item.created_at)}
        </p>
      </div>
    </div>
  );

  if (item.link_path) {
    return (
      <li>
        <Link
          to={item.link_path}
          className="block transition hover:bg-paper-soft"
          onClick={() => {
            if (isUnread) onRead();
          }}
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li className={isUnread ? 'cursor-pointer' : undefined} onClick={isUnread ? onRead : undefined}>
      {content}
    </li>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
