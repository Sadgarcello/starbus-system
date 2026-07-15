import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import {
  useNormalizeHobby,
  usePendingHobbySuggestions,
  useRejectHobbySuggestion,
} from '@/hooks/useHobbies';
import {
  useActiveStudents,
  useApproveMember,
  usePendingMembers,
  useRejectMember,
  useSetMemberLocked,
} from '@/hooks/useMembership';

export default function ApprovalsPage() {
  const pending = usePendingMembers(true);
  const students = useActiveStudents(true);
  const hobbyPending = usePendingHobbySuggestions(true);
  const approve = useApproveMember();
  const reject = useRejectMember();
  const setLocked = useSetMemberLocked();
  const normalize = useNormalizeHobby();
  const rejectHobby = useRejectHobbySuggestion();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canonicalById, setCanonicalById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  if (pending.isLoading) return <Spinner />;

  const pendingCount = pending.data?.length ?? 0;
  const hobbyCount = hobbyPending.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Admin</p>
        <h1 className="page-title">Approvals</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Student requests, interest normalization, and account locks.
        </p>
      </div>

      {(pendingCount > 0 || hobbyCount > 0) && (
        <div className="rounded-lg border border-ink bg-club px-4 py-3 text-sm font-semibold text-ink">
          {[
            pendingCount > 0
              ? pendingCount === 1
                ? '1 student waiting for approval'
                : `${pendingCount} students waiting for approval`
              : null,
            hobbyCount > 0
              ? hobbyCount === 1
                ? '1 interest to normalize'
                : `${hobbyCount} interests to normalize`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          .
        </div>
      )}

      {notice && <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
      {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {hobbyPending.isError && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          Could not load interest suggestions:{' '}
          {(hobbyPending.error as Error).message || 'unknown error'}. Confirm migration 0005 ran
          in Khawaja Club DB.
        </p>
      )}

      <Card>
        <CardHeader title="Pending requests" subtitle={`${pendingCount} waiting`} />
        <div className="divide-y divide-paper-line">
          {pendingCount === 0 && (
            <p className="p-4 text-sm text-ink-subtle">No pending registrations.</p>
          )}
          {(pending.data ?? []).map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{p.name || '—'}</p>
                <p className="truncate text-xs text-ink-subtle">{p.email}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">
                  Requested {new Date(p.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  loading={approve.isPending}
                  onClick={async () => {
                    setError(null);
                    setNotice(null);
                    try {
                      await approve.mutateAsync({ userId: p.id, role: 'student' });
                      setNotice(`Approved ${p.name || p.email}`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Approve failed');
                    }
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={reject.isPending}
                  onClick={async () => {
                    setError(null);
                    setNotice(null);
                    try {
                      await reject.mutateAsync(p.id);
                      setNotice(`Rejected ${p.name || p.email}`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Reject failed');
                    }
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Interest suggestions"
          subtitle="Normalize student wording into a shared club hobby (e.g. soccer → Football)"
        />
        <div className="divide-y divide-paper-line">
          {hobbyPending.isLoading && (
            <p className="p-4 text-sm text-ink-subtle">Loading interests…</p>
          )}
          {!hobbyPending.isLoading && !hobbyPending.isError && hobbyCount === 0 && (
            <p className="p-4 text-sm text-ink-subtle">
              No interest suggestions waiting. Students must use Settings → Suggest interest
              (new wording). Picking an existing club hobby skips this queue.
            </p>
          )}
          {(hobbyPending.data ?? []).map((s) => {
            const studentName =
              s.student?.profile?.name || s.student?.profile?.email || 'Student';
            const value = canonicalById[s.id] ?? suggestCanonical(s.raw_text);
            return (
              <div key={s.id} className="flex flex-col gap-3 px-4 py-4">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    “{s.raw_text}”{' '}
                    <span className="font-normal text-ink-subtle">from {studentName}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    Suggested {new Date(s.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={value}
                    onChange={(e) =>
                      setCanonicalById((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    placeholder="Canonical hobby name"
                    className="min-w-0 flex-1 rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      loading={normalize.isPending}
                      onClick={async () => {
                        setError(null);
                        setNotice(null);
                        try {
                          await normalize.mutateAsync({
                            suggestionId: s.id,
                            canonicalName: value,
                          });
                          setNotice(`Normalized “${s.raw_text}” → ${value.trim()}`);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Normalize failed');
                        }
                      }}
                    >
                      Save as hobby
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={rejectHobby.isPending}
                      onClick={async () => {
                        setError(null);
                        setNotice(null);
                        try {
                          await rejectHobby.mutateAsync(s.id);
                          setNotice(`Rejected “${s.raw_text}”`);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Reject failed');
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Students"
          subtitle="Lock a student to block app access until you unlock them"
        />
        <div className="divide-y divide-paper-line">
          {students.isLoading && <p className="p-4 text-sm text-ink-subtle">Loading students…</p>}
          {!students.isLoading && (students.data ?? []).length === 0 && (
            <p className="p-4 text-sm text-ink-subtle">No active students yet.</p>
          )}
          {(students.data ?? []).map((p) => {
            const locked = Boolean(p.is_locked);
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{p.name || '—'}</p>
                  <p className="truncate text-xs text-ink-subtle">{p.email}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                    {locked ? 'Locked' : 'Active'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={locked ? 'primary' : 'danger'}
                  loading={setLocked.isPending}
                  onClick={async () => {
                    setError(null);
                    setNotice(null);
                    try {
                      await setLocked.mutateAsync({ userId: p.id, locked: !locked });
                      setNotice(
                        locked
                          ? `Unlocked ${p.name || p.email}`
                          : `Locked ${p.name || p.email}`,
                      );
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Lock update failed');
                    }
                  }}
                >
                  {locked ? 'Unlock' : 'Lock'}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/** Light default so admin can edit — soccer stays soccer until they type Football. */
function suggestCanonical(raw: string) {
  return raw.trim();
}
