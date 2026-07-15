import { Link } from 'react-router-dom';
import { AttendanceCta } from '@/components/attendance/AttendanceCta';
import { StatusBadge, TypeBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { usePendingReviews, useStudentAssignments, useStudents } from '@/hooks/useAcademy';
import { paths } from '@/routes/paths';

export default function DashboardPage() {
  const { isTeacher, isStudent, profile, student } = useAuth();

  if (isTeacher) return <TeacherHome teacherId={profile!.id} />;
  if (isStudent && student) return <StudentHome studentId={student.id} student={student} />;
  return (
    <Card className="p-6">
      <p className="text-sm text-ink-muted">No role dashboard available for this account.</p>
    </Card>
  );
}

function StudentHome({
  studentId,
  student,
}: {
  studentId: string;
  student: { xp: number; streak: number; level: string };
}) {
  const query = useStudentAssignments(studentId);
  const tasks = (query.data ?? []).filter((a) => a.status === 'assigned' || a.status === 'returned');
  const done = (query.data ?? []).filter((a) => a.status === 'submitted' || a.status === 'reviewed');
  const total = query.data?.length ?? 0;
  const completion = total === 0 ? 0 : Math.round((done.length / total) * 100);

  if (query.isLoading) return <Spinner />;
  if (query.isError) {
    return (
      <Card className="p-6">
        <p className="text-sm text-danger">Could not load your tasks. Pull to refresh or try again later.</p>
        <Button className="mt-3" variant="secondary" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Today</p>
        <h1 className="page-title">Your tasks</h1>
      </div>

      <AttendanceCta studentId={studentId} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="XP" value={String(student.xp)} />
        <Stat label="Streak" value={String(student.streak)} />
        <Stat label="Level" value={student.level} />
        <Stat label="Completion" value={`${completion}%`} />
      </div>

      <Card>
        <CardHeader title="Today's Tasks" subtitle="Complete these to keep your streak" />
        <div className="divide-y divide-paper-line">
          {tasks.length === 0 ? (
            <p className="p-4 text-sm text-ink-subtle">No open tasks. Nice work.</p>
          ) : (
            tasks.map((a) => (
              <Link
                key={a.id}
                to={paths.assignment(a.id)}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-club-soft/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{a.activity.title}</p>
                  <div className="mt-1 flex gap-2">
                    <TypeBadge type={a.activity.type} />
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                <span className="text-xs font-bold text-ink-subtle">+{a.activity.xp} XP</span>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function TeacherHome({ teacherId }: { teacherId: string }) {
  const students = useStudents(teacherId);
  const pending = usePendingReviews(true);

  if (students.isLoading || pending.isLoading) return <Spinner />;
  if (students.isError || pending.isError) {
    return (
      <Card className="p-6">
        <p className="text-sm text-danger">Could not load the classroom dashboard.</p>
        <Button
          className="mt-3"
          variant="secondary"
          onClick={() => {
            void students.refetch();
            void pending.refetch();
          }}
        >
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Teacher</p>
          <h1 className="page-title">Classroom pulse</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={paths.attendance}>
            <Button variant="secondary">Attendance</Button>
          </Link>
          <Link to={paths.teacher}>
            <Button>Open Studio</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Students" subtitle={`${students.data?.length ?? 0} in your roster`} />
          <div className="divide-y divide-paper-line">
            {(students.data ?? []).slice(0, 8).map((s) => (
              <Link
                key={s.id}
                to={paths.student(s.id)}
                className="flex items-center justify-between px-4 py-3 hover:bg-club-soft/40"
              >
                <div>
                  <p className="font-semibold text-ink">{s.profile?.name || s.profile?.email}</p>
                  <p className="text-xs text-ink-subtle">
                    {s.level} · {s.xp} XP · streak {s.streak}
                  </p>
                </div>
                <span className="text-xs font-bold text-ink-subtle">View</span>
              </Link>
            ))}
            {(students.data ?? []).length === 0 && (
              <p className="p-4 text-sm text-ink-subtle">No students yet. Create one in Studio.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pending reviews" subtitle="Submitted work waiting on you" />
          <div className="divide-y divide-paper-line">
            {(pending.data ?? []).map((a) => (
              <Link
                key={a.id}
                to={paths.assignment(a.id)}
                className="flex items-center justify-between px-4 py-3 hover:bg-club-soft/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{a.activity.title}</p>
                  <div className="mt-1">
                    <TypeBadge type={a.activity.type} />
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </Link>
            ))}
            {(pending.data ?? []).length === 0 && (
              <p className="p-4 text-sm text-ink-subtle">Inbox clear.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
    </Card>
  );
}
