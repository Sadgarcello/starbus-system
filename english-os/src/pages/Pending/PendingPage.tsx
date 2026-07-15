import { Navigate } from 'react-router-dom';
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
  if (isActive) return <Navigate to={paths.dashboard} replace />;

  const rejected = isRejected;
  const locked = isLocked && !rejected;

  const title = locked
    ? 'Account locked'
    : rejected
      ? 'Request declined'
      : 'Waiting for approval';

  const body = locked
    ? 'Your profile is locked. Please message the Admin so they can tell you the issue and why your access was locked. You can enter again once they unlock you.'
    : rejected
      ? 'An admin did not approve this account. Contact Khawaja Club if you think this is a mistake.'
      : `Hi ${profile?.name || 'there'}. Your student access request is with the admin. You’ll get in once they approve.`;

  return (
    <Card className="space-y-5 p-6 text-center">
      <img
        src="/khawaja-club-logo.png"
        alt="Khawaja Club"
        className="mx-auto h-20 w-20 rounded-full object-cover ring-1 ring-black/10"
      />
      <div>
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{body}</p>
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
