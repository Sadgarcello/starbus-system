import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { SkillGauge } from '@/components/student/SkillGauge';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { useSocialProfiles } from '@/hooks/useSocial';
import { paths } from '@/routes/paths';
import type { SocialProfile } from '@/types';

export default function SocialPage() {
  const { isTeacher } = useAuth();
  const profiles = useSocialProfiles();

  if (profiles.isLoading) return <Spinner />;

  if (profiles.isError) {
    return (
      <Card className="p-6 text-sm text-danger">
        Could not load social profiles. Run{' '}
        <code className="font-mono">0012_social_profiles.sql</code> in Khawaja Club DB.
        <br />
        {(profiles.error as Error).message}
      </Card>
    );
  }

  const list = profiles.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Club</p>
        <h1 className="page-title">Social</h1>
        <p className="mt-1 text-sm text-ink-muted">
          See classmates — photo and progress only. No private details.
        </p>
      </div>

      {list.length === 0 ? (
        <Card className="p-6 text-sm text-ink-subtle">No student profiles to show yet.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <SocialCard key={p.student_id} profile={p} showTeacherLink={isTeacher} />
          ))}
        </div>
      )}
    </div>
  );
}

function SocialCard({
  profile,
  showTeacherLink,
}: {
  profile: SocialProfile;
  showTeacherLink: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col items-center bg-club-soft/50 px-5 pb-5 pt-8 text-center">
        <Avatar
          path={profile.avatar}
          name={profile.name}
          size="xl"
          className="ring-4 ring-paper shadow-md"
        />
        <h2 className="mt-4 truncate font-display text-2xl text-ink">{profile.name}</h2>
        <p className="mt-1 text-sm font-semibold text-ink-muted">Level {profile.level}</p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {profile.xp} XP · streak {profile.streak}
        </p>
      </div>

      <div className="flex justify-center gap-6 px-4 py-5">
        <SkillGauge
          label="Speaking"
          percent={profile.speaking_progress}
          skillKey="speaking"
          size={84}
        />
        <SkillGauge
          label="Reading"
          percent={profile.reading_progress}
          skillKey="reading"
          size={84}
        />
      </div>

      {showTeacherLink && (
        <div className="border-t border-paper-line px-4 py-3 text-center">
          <Link
            to={paths.student(profile.student_id)}
            className="text-xs font-bold uppercase tracking-wide text-ink-subtle hover:text-ink"
          >
            Open full profile
          </Link>
        </div>
      )}
    </Card>
  );
}
