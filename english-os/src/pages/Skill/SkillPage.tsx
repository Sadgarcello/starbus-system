import { Link } from 'react-router-dom';
import { StatusBadge, TypeBadge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { useActivities, useStudentAssignments } from '@/hooks/useAcademy';
import type { ActivityType } from '@/types';
import { paths } from '@/routes/paths';

const titles: Record<ActivityType, { title: string; blurb: string }> = {
  speaking: { title: 'Speaking', blurb: 'Recordings, debates, and oral practice.' },
  reading: { title: 'Reading', blurb: 'Chapters, articles, and comprehension.' },
  writing: { title: 'Writing', blurb: 'Essays, diaries, and structured responses.' },
  listening: { title: 'Listening', blurb: 'Audio, podcasts, and note-taking.' },
};

export default function SkillPage({ type }: { type: ActivityType }) {
  const { isTeacher, student } = useAuth();
  const meta = titles[type];
  const activities = useActivities(type);
  const assignments = useStudentAssignments(student?.id);

  if (activities.isLoading || assignments.isLoading) return <Spinner />;

  const studentItems = (assignments.data ?? []).filter((a) => a.activity.type === type);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Skill module</p>
        <h1 className="page-title">{meta.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{meta.blurb} Same Activity Engine underneath.</p>
      </div>

      {isTeacher ? (
        <Card>
          <CardHeader title={`${meta.title} activities`} subtitle="Create more in Studio" />
          <div className="divide-y divide-paper-line">
            {(activities.data ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-xs text-ink-subtle">+{a.xp} XP</p>
                </div>
                <TypeBadge type={a.type} />
              </div>
            ))}
            {(activities.data ?? []).length === 0 && (
              <p className="p-4 text-sm text-ink-subtle">No {type} activities yet.</p>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title={`Your ${meta.title} work`} />
          <div className="divide-y divide-paper-line">
            {studentItems.map((a) => (
              <Link
                key={a.id}
                to={paths.assignment(a.id)}
                className="flex items-center justify-between px-4 py-3 hover:bg-club-soft/40"
              >
                <p className="font-semibold">{a.activity.title}</p>
                <StatusBadge status={a.status} />
              </Link>
            ))}
            {studentItems.length === 0 && (
              <p className="p-4 text-sm text-ink-subtle">Nothing assigned in this skill yet.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
