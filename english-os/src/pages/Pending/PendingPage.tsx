import { Navigate } from 'react-router-dom';
import { WelcomeProfileHeader } from '@/components/profile/WelcomeProfileHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { paths } from '@/routes/paths';

export default function PendingPage() {
  const {
    loading,
    isAuthenticated,
    isActive,
    isRejected,
    isLocked,
    profile,
    signOut,
    refresh,
  } = useAuth();

  if (loading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to={paths.login} replace />;
  if (isActive) return <Navigate to={paths.home} replace />;

  const rejected = isRejected;
  const locked = isLocked && !rejected;

  const statusTitle = locked
    ? 'Account locked'
    : rejected
      ? 'Request declined'
      : 'Waiting for approval';

  const statusBody = locked
    ? 'Your profile is locked. Please message the Admin so they can tell you the issue and why your access was locked. You can enter again once they unlock you.'
    : rejected
      ? 'An admin did not approve this account. Contact Khawaja Club if you think this is a mistake.'
      : 'Your student access request is with the admin. You’ll get in once they approve.';

  return (
    <Card className="space-y-6 p-6">
      <WelcomeProfileHeader
        compact
        name={profile?.name}
        email={profile?.email}
        avatar={profile?.avatar}
        subtitle="Thanks for joining Khawaja Club. Here’s your profile while we finish setting things up."
      />

      <div className="rounded-md border border-paper-line bg-paper-soft/80 px-4 py-3 text-center">
        <h2 className="font-display text-xl text-ink">{statusTitle}</h2>
        <p className="mt-2 text-sm text-ink-muted">{statusBody}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        {!rejected && (
          <Button variant="secondary" onClick={() => void refresh()}>
            Check again
          </Button>
        )}
        <Button
          variant="primary"
          onClick={async () => {
            await signOut();
          }}
        >
          Sign out
        </Button>
      </div>
    </Card>
  );
}
