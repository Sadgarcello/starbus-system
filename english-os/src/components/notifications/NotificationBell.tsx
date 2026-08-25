import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

export function NotificationBell({ className }: { className?: string }) {
  const { profile } = useAuth();
  const { unreadCount } = useNotifications(profile?.id);

  return (
    <Link
      to={paths.notifications}
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      className={cn(
        'relative inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-white/20 bg-white/5 text-paper transition hover:bg-white/10',
        className,
      )}
    >
      <BellIcon />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-club px-1 text-[10px] font-bold leading-none text-ink">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
