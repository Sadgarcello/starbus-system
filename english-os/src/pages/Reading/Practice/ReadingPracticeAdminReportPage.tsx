import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ReadingPracticeResults } from '@/components/readingPractice/ReadingPracticeResults';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import type { SessionResultsSummary } from '@/lib/readingPractice/types';
import { readingPracticeService } from '@/services/readingPracticeService';
import { studentService } from '@/services/studentService';
import { paths } from '@/routes/paths';

export default function ReadingPracticeAdminReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [params] = useSearchParams();
  const studentId = params.get('studentId') ?? '';
  const { isTeacher } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SessionResultsSummary | null>(null);
  const [studentName, setStudentName] = useState<string>('Student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isTeacher || !sessionId || !studentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      readingPracticeService.getReport(sessionId, studentId),
      studentService.getById(studentId),
    ])
      .then(([report, student]) => {
        if (cancelled) return;
        setSummary(report);
        setStudentName(student?.profile?.name || student?.profile?.email || 'Student');
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isTeacher, sessionId, studentId]);

  if (!isTeacher) {
    return (
      <Card className="p-6 text-sm">Teachers and admins can view student reading reports here.</Card>
    );
  }

  if (!sessionId || !studentId) {
    return (
      <Card className="space-y-3 p-6 text-sm text-danger">
        <p>Missing student or session. Go back and choose a student first.</p>
        <Link to={paths.readingPracticeAdminResults}>
          <Button variant="secondary">Back to student results</Button>
        </Link>
      </Card>
    );
  }

  if (loading) return <Spinner />;

  if (error || !summary) {
    return (
      <Card className="space-y-3 p-6 text-sm text-danger">
        <p>{error ?? 'Report not found.'}</p>
        <Link to={paths.readingPracticeAdminResults}>
          <Button variant="secondary">Back to student results</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <Link
          to={paths.readingPracticeAdminResults}
          className="text-xs font-bold uppercase tracking-wide text-ink-subtle hover:text-ink"
        >
          ← Back to student results
        </Link>
        <p className="mt-2 text-sm text-ink-muted">
          Viewing report for <strong className="text-ink">{studentName}</strong>
        </p>
      </div>
      <ReadingPracticeResults
        summary={summary}
        onSelectHistory={(id) =>
          navigate(paths.readingPracticeAdminReport(id, studentId))
        }
      />
    </div>
  );
}
