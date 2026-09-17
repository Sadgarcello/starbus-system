import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { ReadingPracticeHistoryPanel } from '@/components/readingPractice/ReadingPracticeHistoryPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import type { ReadingPracticeMode, SessionHistoryEntry } from '@/lib/readingPractice/types';
import { readingPracticeService } from '@/services/readingPracticeService';
import { studentService } from '@/services/studentService';
import { paths } from '@/routes/paths';
import type { StudentWithProfile } from '@/types';

export default function ReadingPracticeResultsAdminPage() {
  const { isTeacher } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [modeFilter, setModeFilter] = useState<ReadingPracticeMode | 'ALL'>('ALL');
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTeacher) return;
    setStudentsLoading(true);
    void studentService
      .listAll()
      .then((rows) => setStudents(rows.filter((s) => s.exam_track === 'toefl')))
      .catch((e) => setError((e as Error).message))
      .finally(() => setStudentsLoading(false));
  }, [isTeacher]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );

  useEffect(() => {
    if (!selectedStudentId) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    setError(null);

    void readingPracticeService
      .getHistory({
        studentId: selectedStudentId,
        mode: modeFilter === 'ALL' ? undefined : modeFilter,
      })
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStudentId, modeFilter]);

  if (!isTeacher) {
    return (
      <Card className="p-6 text-sm">Teachers and admins can view student reading results here.</Card>
    );
  }

  const studentName =
    selectedStudent?.profile?.name || selectedStudent?.profile?.email || 'Student';

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to={paths.readingPracticeAdmin}
        className="text-xs font-bold uppercase tracking-wide text-ink-subtle hover:text-ink"
      >
        ← Reading practice admin
      </Link>

      <div>
        <h1 className="page-title">Student reading results</h1>
        <p className="mt-1 text-sm text-ink-muted">
          View Complete the Words, Daily Life, and Academic reports for any TOEFL student. Students
          can only see their own results.
        </p>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</Card>
      )}

      <Card className="p-4">
        <label className="block text-sm">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
            Select student
          </span>
          {studentsLoading ? (
            <Spinner />
          ) : students.length === 0 ? (
            <p className="text-sm text-ink-muted">No TOEFL students found yet.</p>
          ) : (
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">Choose a student…</option>
              {students.map((s) => {
                const name = s.profile?.name || s.profile?.email || s.id;
                return (
                  <option key={s.id} value={s.id}>
                    {name} · {s.level}
                  </option>
                );
              })}
            </select>
          )}
        </label>

        {selectedStudent && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-paper-line bg-paper-soft/40 px-3 py-2">
            <Avatar
              path={selectedStudent.profile?.avatar}
              name={selectedStudent.profile?.name}
              email={selectedStudent.profile?.email}
              size="sm"
            />
            <div>
              <p className="font-semibold text-ink">{studentName}</p>
              <p className="text-xs text-ink-muted">
                Official level {selectedStudent.level} · TOEFL reading practice
              </p>
            </div>
          </div>
        )}
      </Card>

      {selectedStudentId ? (
        <ReadingPracticeHistoryPanel
          history={history}
          loading={historyLoading}
          modeFilter={modeFilter}
          onModeFilterChange={setModeFilter}
          reportHref={(sessionId) =>
            paths.readingPracticeAdminReport(sessionId, selectedStudentId)
          }
          emptyMessage={`${studentName} has not finished a reading session in this mode yet.`}
        />
      ) : (
        <Card className="p-6 text-sm text-ink-muted">
          Select a student to load their latest and past reading exam results.
        </Card>
      )}

      {selectedStudentId && history.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={() =>
              navigate(paths.readingPracticeAdminReport(history[0]!.sessionId, selectedStudentId))
            }
          >
            Open latest report
          </Button>
        </div>
      )}
    </div>
  );
}
