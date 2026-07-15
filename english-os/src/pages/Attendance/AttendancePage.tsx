import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AttendanceCta } from '@/components/attendance/AttendanceCta';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import {
  useAttendanceSession,
  useCloseAttendance,
  useOpenAttendance,
  useSessionMarks,
} from '@/hooks/useAttendance';
import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '@/services/attendanceService';
import { studentService } from '@/services/studentService';
import { paths } from '@/routes/paths';

export default function AttendancePage() {
  const { isTeacher, isStudent, student, profile } = useAuth();

  if (isTeacher && profile) return <TeacherAttendance teacherId={profile.id} />;
  if (isStudent && student) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Attendance</p>
          <h1 className="page-title">Check in</h1>
        </div>
        <AttendanceCta studentId={student.id} />
      </div>
    );
  }

  return (
    <Card className="p-6">
      <p className="text-sm text-ink-muted">Attendance is available for teachers and students.</p>
    </Card>
  );
}

function TeacherAttendance({ teacherId }: { teacherId: string }) {
  const [date, setDate] = useState(attendanceService.todayLocal());
  const sessionQuery = useAttendanceSession(date);
  const session = sessionQuery.data ?? null;
  const marksQuery = useSessionMarks(session?.id);
  const studentsQuery = useQuery({
    queryKey: ['students', 'all'],
    queryFn: () => studentService.listAll(),
  });
  const openMut = useOpenAttendance();
  const closeMut = useCloseAttendance();

  const { present, absent } = useMemo(() => {
    const students = studentsQuery.data ?? [];
    const presentIds = new Set((marksQuery.data ?? []).map((m) => m.student_id));
    return {
      present: students.filter((s) => presentIds.has(s.id)),
      absent: students.filter((s) => !presentIds.has(s.id)),
    };
  }, [studentsQuery.data, marksQuery.data]);

  const busy = openMut.isPending || closeMut.isPending;

  if (sessionQuery.isLoading || studentsQuery.isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Attendance</p>
          <h1 className="page-title">Day session</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Open a day for the whole club. Students can press “I attended” only while it is open.
          </p>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
            Date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
          />
        </label>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              {date} ·{' '}
              <span className={session?.status === 'open' ? 'text-success' : 'text-ink-muted'}>
                {session ? session.status : 'no session'}
              </span>
            </p>
            {session?.opened_at && (
              <p className="mt-1 text-xs text-ink-subtle">
                Opened {new Date(session.opened_at).toLocaleString()}
                {session.closed_at
                  ? ` · Closed ${new Date(session.closed_at).toLocaleString()}`
                  : ''}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy && openMut.isPending}
              disabled={busy || session?.status === 'open'}
              onClick={() => openMut.mutate({ sessionDate: date, teacherId })}
            >
              Take attendance
            </Button>
            <Button
              variant="secondary"
              loading={busy && closeMut.isPending}
              disabled={busy || !session || session.status !== 'open'}
              onClick={() => session && closeMut.mutate(session.id)}
            >
              Close attendance
            </Button>
          </div>
        </div>
        {(openMut.isError || closeMut.isError) && (
          <p className="mt-3 text-sm text-danger">
            {((openMut.error || closeMut.error) as Error).message}
          </p>
        )}
      </Card>

      {session && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Present"
              subtitle={`${present.length} marked · ${marksQuery.isFetching ? 'updating…' : ''}`}
            />
            <StudentList students={present} empty="No one has checked in yet." />
          </Card>
          <Card>
            <CardHeader title="Not marked" subtitle={`${absent.length} remaining`} />
            <StudentList students={absent} empty="Everyone is marked present." />
          </Card>
        </div>
      )}
    </div>
  );
}

function StudentList({
  students,
  empty,
}: {
  students: Array<{
    id: string;
    profile?: { name: string | null; email: string; avatar: string | null } | null;
  }>;
  empty: string;
}) {
  if (students.length === 0) {
    return <p className="p-4 text-sm text-ink-subtle">{empty}</p>;
  }
  return (
    <div className="divide-y divide-paper-line">
      {students.map((s) => (
        <Link
          key={s.id}
          to={paths.student(s.id)}
          className="flex items-center gap-3 px-4 py-3 hover:bg-club-soft/40"
        >
          <Avatar
            path={s.profile?.avatar}
            name={s.profile?.name}
            email={s.profile?.email}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">
              {s.profile?.name || s.profile?.email}
            </p>
            <p className="truncate text-xs text-ink-subtle">{s.profile?.email}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
