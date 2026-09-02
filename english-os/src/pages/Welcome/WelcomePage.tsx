import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ExamTrackBadge } from '@/components/exam/ExamTrackBadge';
import { ExamTrackSelector } from '@/components/exam/ExamTrackSelector';
import { PushEnableBanner } from '@/components/notifications/PushEnableBanner';
import { WelcomeProfileHeader } from '@/components/profile/WelcomeProfileHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { formatAppTime } from '@/lib/formatAppTime';
import { paths } from '@/routes/paths';
import type { ExamTrack } from '@/types';

export default function WelcomePage() {
  const { profile, student, isTeacher, isAdmin, isStudent, refresh } = useAuth();
  const [savedTrack, setSavedTrack] = useState<ExamTrack | null>(null);

  useEffect(() => {
    if (student?.exam_track) {
      setSavedTrack(null);
    }
  }, [student?.exam_track]);

  const examTrack = (student?.exam_track ?? savedTrack) as ExamTrack | null | undefined;

  const subtitle = isAdmin
    ? 'You’re signed in as admin. Manage approvals, support students, and keep Khawaja Club running smoothly.'
    : isTeacher
      ? 'You’re signed in as a teacher. Open your classroom, track attendance, and guide your students.'
      : 'Welcome to Khawaja Club. Your profile is ready — jump into speaking, reading, writing, and listening when you’re set.';

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {isStudent && student && !examTrack && (
        <ExamTrackSelector
          studentId={student.id}
          currentTrack={examTrack}
          onSaved={async (track) => {
            setSavedTrack(track);
            await refresh();
          }}
          required
        />
      )}

      <Card className="overflow-hidden border-club/30 bg-gradient-to-b from-club-soft/80 to-paper">
        <div className="px-6 pb-6 pt-8">
          <WelcomeProfileHeader
            name={profile?.name}
            email={profile?.email}
            avatar={profile?.avatar}
            subtitle={subtitle}
          />
          {isStudent && student && (
            <>
              <p className="mt-4 text-xs text-ink-subtle">
                Time in Khawaja Club:{' '}
                <span className="font-semibold text-ink-muted">
                  {formatAppTime(student.app_time_seconds ?? 0)}
                </span>
              </p>
              {examTrack && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
                    Preparing for
                  </span>
                  <ExamTrackBadge
                    track={examTrack}
                    className="[&_img]:h-8 [&_img]:max-w-[120px]"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-paper-line bg-paper/60 px-4 py-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <ProfileStat label="Role" value={profile?.role ?? '—'} />
            {student ? (
              <>
                <ProfileStat label="Level" value={student.level} />
                <ProfileStat label="XP" value={String(student.xp)} />
                <ProfileStat label="Streak" value={`${student.streak} days`} />
              </>
            ) : (
              <ProfileStat label="Status" value={profile?.status ?? 'active'} />
            )}
          </dl>
        </div>
      </Card>

      <PushEnableBanner />

      <div className="flex flex-col gap-2 sm:flex-row">
        {isStudent ? (
          <Link to={paths.speaking} className="flex-1">
            <Button className="w-full">Start practicing</Button>
          </Link>
        ) : (
          <Link to={paths.dashboard} className="flex-1">
            <Button className="w-full">Continue to Dashboard</Button>
          </Link>
        )}
        <Link to={paths.settings} className="flex-1">
          <Button variant="secondary" className="w-full">
            Edit profile
          </Button>
        </Link>
      </div>

      {isAdmin && (
        <Link to={paths.approvals}>
          <Button variant="secondary" className="w-full">
            Open Approvals
          </Button>
        </Link>
      )}
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-paper-line bg-paper px-3 py-2 text-left">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 font-semibold capitalize text-ink">{value}</dd>
    </div>
  );
}
