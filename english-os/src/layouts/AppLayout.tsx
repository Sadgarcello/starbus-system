import { useEffect, useState, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useAppTimeTracker } from '@/hooks/useAppTimeTracker';
import { usePendingMembers } from '@/hooks/useMembership';
import { ensureServiceWorker } from '@/lib/pushNotifications';
import { requestNotificationPermission } from '@/lib/browserNotify';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

type NavItem = { to: string; label: string; short: string };

const teacherPrimary: NavItem[] = [
  { to: paths.home, label: 'Profile', short: 'Profile' },
  { to: paths.dashboard, label: 'Dashboard', short: 'Home' },
  { to: paths.teacher, label: 'Studio', short: 'Studio' },
  { to: paths.attendance, label: 'Attendance', short: 'Attend' },
  { to: paths.speaking, label: 'Speaking', short: 'Speak' },
  { to: paths.writing, label: 'Writing', short: 'Write' },
];

const teacherMore: NavItem[] = [
  { to: paths.reading, label: 'Reading', short: 'Read' },
  { to: paths.listening, label: 'Listening', short: 'Listen' },
  { to: paths.social, label: 'Social', short: 'Social' },
  { to: paths.analytics, label: 'Analytics', short: 'Stats' },
  { to: paths.settings, label: 'Settings', short: 'Settings' },
];

const studentPrimary: NavItem[] = [
  { to: paths.home, label: 'Profile', short: 'Profile' },
  { to: paths.speaking, label: 'Speaking', short: 'Speak' },
  { to: paths.writing, label: 'Writing', short: 'Write' },
  { to: paths.reading, label: 'Reading', short: 'Read' },
  { to: paths.listening, label: 'Listening', short: 'Listen' },
];

const studentMore: NavItem[] = [
  { to: paths.social, label: 'Social', short: 'Social' },
  { to: paths.settings, label: 'Settings', short: 'Settings' },
];

const studentMobilePrimary: NavItem[] = [
  ...studentPrimary,
  { to: paths.social, label: 'Social', short: 'Social' },
];

const teacherMobilePrimary: NavItem[] = [
  { to: paths.home, label: 'Profile', short: 'Profile' },
  { to: paths.dashboard, label: 'Dashboard', short: 'Home' },
  { to: paths.teacher, label: 'Studio', short: 'Studio' },
  { to: paths.speaking, label: 'Speaking', short: 'Speak' },
  { to: paths.writing, label: 'Writing', short: 'Write' },
  { to: paths.social, label: 'Social', short: 'Social' },
];

const teacherMobileMore: NavItem[] = [
  { to: paths.attendance, label: 'Attendance', short: 'Attend' },
  { to: paths.reading, label: 'Reading', short: 'Read' },
  { to: paths.listening, label: 'Listening', short: 'Listen' },
  { to: paths.analytics, label: 'Analytics', short: 'Stats' },
];

function DesktopNavLink({
  link,
  badge,
}: {
  link: NavItem;
  badge?: number;
}) {
  return (
    <NavLink
      to={link.to}
      end={link.to === paths.home}
      className={({ isActive }) =>
        cn(
          'inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition',
          isActive ? 'bg-club text-ink' : 'text-paper/80 hover:bg-white/10 hover:text-paper',
        )
      }
    >
      {link.label}
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold leading-none text-club">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  );
}

function MobileTab({
  link,
  badge,
  onNavigate,
}: {
  link: NavItem;
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={link.to}
      end={link.to === paths.home}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 text-[10px] font-semibold uppercase tracking-wide',
          isActive ? 'text-club' : 'text-paper/70',
        )
      }
    >
      <span className="truncate">{link.short}</span>
      {badge != null && badge > 0 && (
        <span className="absolute right-1 top-1 rounded-full bg-club px-1 text-[9px] font-bold leading-4 text-ink">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  );
}

function SettingsNavIcon() {
  return (
    <NavLink
      to={paths.settings}
      aria-label="Settings"
      className={({ isActive }) =>
        cn(
          'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-white/20 bg-white/5 text-paper transition hover:bg-white/10 md:hidden',
          isActive && 'bg-white/15 text-club',
        )
      }
    >
      <GearIcon />
    </NavLink>
  );
}

function GearIcon() {
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function AppLayout() {
  const { profile, isTeacher, isAdmin, isActive, isStudent, student, signOut, refresh } = useAuth();
  const pending = usePendingMembers(isAdmin);
  const pendingCount = pending.data?.length ?? 0;
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const syncAppTime = useCallback(() => {
    void refresh();
  }, [refresh]);

  useAppTimeTracker(student?.id, isActive && isStudent, syncAppTime);

  useEffect(() => {
    if (isActive) void ensureServiceWorker();
  }, [isActive]);

  useEffect(() => {
    if (isActive) requestNotificationPermission();
  }, [isActive]);

  const primary = isTeacher ? teacherPrimary : studentPrimary;
  const more = [
    ...(isTeacher ? teacherMore : studentMore),
    ...(isAdmin ? [{ to: paths.approvals, label: 'Approvals', short: 'Approvals' }] : []),
  ];
  const mobilePrimary = isTeacher ? teacherMobilePrimary : studentMobilePrimary;
  const mobileMore = [
    ...(isTeacher ? teacherMobileMore : []),
    ...(isAdmin ? [{ to: paths.approvals, label: 'Approvals', short: 'Approvals' }] : []),
  ];
  const showMobileMore = mobileMore.length > 0;

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await signOut();
    navigate(paths.login, { replace: true });
  }

  return (
    <div className="min-h-dvh bg-paper-soft pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-ink bg-ink text-paper safe-pt">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <Logo
            size="sm"
            className="min-w-0 [&_p]:text-paper [&_p:last-child]:text-club [&_div]:hidden sm:[&_div]:block"
          />
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[12rem] truncate text-xs text-paper/70 lg:inline">
              {profile?.name || profile?.email} · {profile?.role}
            </span>
            <NotificationBell />
            <SettingsNavIcon />
            <Button
              variant="secondary"
              size="sm"
              className="min-h-9 border-club bg-club text-ink hover:bg-club-hover"
              onClick={handleLogout}
            >
              Sign out
            </Button>
          </div>
        </div>

        <nav className="hidden border-t border-white/10 md:block">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-2 py-2">
            {[...primary, ...more].map((link) => (
              <DesktopNavLink
                key={link.to}
                link={link}
                badge={link.to === paths.approvals ? pendingCount : undefined}
              />
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-ink text-paper safe-pb md:hidden">
        {moreOpen && showMobileMore && (
          <div className="border-b border-white/10 px-2 py-2">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-1 sm:grid-cols-3">
              {mobileMore.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold uppercase tracking-wide',
                      isActive ? 'bg-club text-ink' : 'bg-white/5 text-paper/85',
                    )
                  }
                >
                  {link.label}
                  {link.to === paths.approvals && pendingCount > 0 && (
                    <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold text-club">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
        <div className="mx-auto flex max-w-6xl items-stretch px-1 py-1">
          {mobilePrimary.map((link) => (
            <MobileTab key={link.to} link={link} />
          ))}
          {showMobileMore && (
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-label="More navigation"
              onClick={() => setMoreOpen((o) => !o)}
              className={cn(
                'relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-md text-[10px] font-semibold uppercase tracking-wide',
                moreOpen ? 'text-club' : 'text-paper/70',
              )}
            >
              More
              {isAdmin && pendingCount > 0 && (
                <span className="absolute right-1 top-1 rounded-full bg-club px-1 text-[9px] font-bold leading-4 text-ink">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
