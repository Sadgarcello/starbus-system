import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  useAttendanceSession,
  useMarkPresent,
  useMyAttendanceMark,
} from '@/hooks/useAttendance';
import { attendanceService } from '@/services/attendanceService';

interface AttendanceCtaProps {
  studentId: string;
}

export function AttendanceCta({ studentId }: AttendanceCtaProps) {
  const today = attendanceService.todayLocal();
  const sessionQuery = useAttendanceSession(today);
  const session = sessionQuery.data;
  const myMark = useMyAttendanceMark(session?.id, studentId);
  const mark = useMarkPresent();

  if (sessionQuery.isLoading || myMark.isLoading) return null;

  if (!session || session.status !== 'open') {
    return (
      <Card className="border-dashed p-4">
        <p className="text-sm font-semibold text-ink">Attendance</p>
        <p className="mt-1 text-sm text-ink-muted">
          {!session
            ? 'No attendance session today yet. Wait for your teacher to open it.'
            : 'Attendance for today is closed.'}
        </p>
      </Card>
    );
  }

  if (myMark.data) {
    return (
      <Card className="border-club bg-club-soft/40 p-4">
        <p className="text-sm font-semibold text-ink">You are marked present</p>
        <p className="mt-1 text-xs text-ink-muted">
          {new Date(myMark.data.marked_at).toLocaleString()} · {today}
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-ink bg-club p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink/70">Today · {today}</p>
      <h2 className="mt-1 font-display text-2xl text-ink">Mark your attendance</h2>
      <p className="mt-1 text-sm text-ink/80">Attendance is open. Tap once to check in.</p>
      <Button
        className="mt-4 w-full sm:w-auto"
        size="lg"
        loading={mark.isPending}
        onClick={() => mark.mutate({ sessionId: session.id, studentId })}
      >
        I attended
      </Button>
      {mark.isError && (
        <p className="mt-2 text-sm text-danger">
          {(mark.error as Error).message || 'Could not mark attendance'}
        </p>
      )}
    </Card>
  );
}
