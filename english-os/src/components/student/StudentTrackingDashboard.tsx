import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { ProgressLineChart } from '@/components/student/ProgressLineChart';
import { SkillGauge } from '@/components/student/SkillGauge';
import { StatusBadge, TypeBadge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useStudentAssignments } from '@/hooks/useAcademy';
import { useStudentAttendanceHistory } from '@/hooks/useAttendance';
import { useStudentHobbies } from '@/hooks/useHobbies';
import {
  buildActivityFeed,
  computeMonthlyProgress,
  computeSkillCompletions,
  type ActivityFeedKind,
} from '@/lib/studentProgress';
import { queryKeys } from '@/lib/queryKeys';
import { studentService } from '@/services/studentService';
import { paths } from '@/routes/paths';
import { useQuery } from '@tanstack/react-query';

interface StudentTrackingDashboardProps {
  studentId: string;
  /** When true, show teacher-oriented secondary lists */
  showDetailLists?: boolean;
}

const KIND_LABEL: Record<ActivityFeedKind, string> = {
  assigned: 'Assigned',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  returned: 'Returned',
  attendance: 'Attendance',
};

export function StudentTrackingDashboard({
  studentId,
  showDetailLists = true,
}: StudentTrackingDashboardProps) {
  const studentQuery = useQuery({
    queryKey: queryKeys.student(studentId),
    queryFn: () => studentService.getById(studentId),
    enabled: Boolean(studentId),
  });
  const assignments = useStudentAssignments(studentId);
  const history = useStudentAttendanceHistory(studentId);
  const hobbies = useStudentHobbies(studentId);

  if (studentQuery.isLoading || assignments.isLoading || history.isLoading) {
    return <Spinner />;
  }

  const s = studentQuery.data;
  if (!s) {
    return <Card className="p-6 text-sm text-danger">Student not found.</Card>;
  }

  const assignmentList = assignments.data ?? [];
  const marks = history.data ?? [];
  const skills = computeSkillCompletions(assignmentList, {
    speakingProgress: s.speaking_progress ?? 0,
    readingProgress: s.reading_progress ?? 0,
  });
  const monthly = computeMonthlyProgress(assignmentList);
  const feed = buildActivityFeed(assignmentList, marks, 10);
  const name = s.profile?.name || s.profile?.email || 'Student';

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">
            System &amp; Tracking
          </p>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">Progress</h1>
        </div>
      </div>

      {/* Profile + gauges */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,220px)_1fr]">
        <Card className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:items-center sm:text-left xl:flex-col xl:text-center">
          <Avatar
            path={s.profile?.avatar}
            name={s.profile?.name}
            email={s.profile?.email}
            size="xl"
            className="ring-2 ring-ink/10"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-2xl text-ink">{name}</p>
            <p className="mt-1 text-sm font-semibold text-ink-muted">Level {s.level}</p>
            <p className="mt-1 text-xs text-ink-subtle">
              {s.xp} XP · streak {s.streak}
            </p>
            {s.profile?.email && (
              <p className="mt-1 truncate text-xs text-ink-subtle">{s.profile.email}</p>
            )}
            {(hobbies.data ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start xl:justify-center">
                {(hobbies.data ?? []).map((h) => (
                  <span
                    key={h.id}
                    className="rounded-md border border-ink/15 bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink"
                  >
                    {h.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible sm:pb-0">
            {skills.map((skill) => (
              <SkillGauge
                key={skill.key}
                label={skill.label}
                percent={skill.percent}
                skillKey={skill.key}
                size={88}
                className="min-w-[5.5rem] shrink-0 sm:min-w-0"
              />
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-ink-subtle">
            Speaking = day practice (+7%). Reading = pages finished (attendees only). Others =
            assignments.
          </p>
        </Card>
      </div>

      {/* Chart + recent */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card>
          <CardHeader title="Progress over time" subtitle="Cumulative XP from reviews" />
          <div className="px-2 pb-3 pt-1 sm:px-3">
            <ProgressLineChart data={monthly} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent activities"
            action={
              <Link
                to={paths.dashboard}
                className="text-xs font-bold uppercase tracking-wide text-ink-subtle hover:text-ink"
              >
                Today
              </Link>
            }
          />
          <div className="max-h-[18rem] divide-y divide-paper-line overflow-y-auto sm:max-h-[20rem]">
            {feed.length === 0 ? (
              <p className="p-4 text-sm text-ink-subtle">No activity yet.</p>
            ) : (
              feed.map((item) => {
                const body = (
                  <div className="flex items-start justify-between gap-3 px-3 py-2.5 sm:px-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                      <p className="truncate text-xs text-ink-subtle">{item.detail}</p>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">
                        {KIND_LABEL[item.kind]} · {new Date(item.at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
                return item.assignmentId ? (
                  <Link
                    key={item.id}
                    to={paths.assignment(item.assignmentId)}
                    className="block transition hover:bg-club-soft/40"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={item.id}>{body}</div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {showDetailLists && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card className="min-w-0">
            <CardHeader
              title="Attendance"
              subtitle={
                marks.length === 0
                  ? 'No check-ins yet'
                  : `${marks.length} days present`
              }
            />
            <div className="max-h-64 divide-y divide-paper-line overflow-y-auto">
              {marks.length === 0 ? (
                <p className="p-4 text-sm text-ink-subtle">No attendance marks recorded.</p>
              ) : (
                marks.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {m.session?.session_date ||
                          new Date(m.marked_at).toLocaleDateString()}
                      </p>
                      <p className="text-[11px] text-ink-subtle">
                        {new Date(m.marked_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-club-soft px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
                      Present
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Assignments" subtitle={`${assignmentList.length} total`} />
            <div className="max-h-64 divide-y divide-paper-line overflow-y-auto">
              {assignmentList.length === 0 ? (
                <p className="p-4 text-sm text-ink-subtle">No assignments yet.</p>
              ) : (
                assignmentList.map((a) => (
                  <Link
                    key={a.id}
                    to={paths.assignment(a.id)}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 transition hover:bg-club-soft/40 sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {a.activity.title}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <TypeBadge type={a.activity.type} />
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
