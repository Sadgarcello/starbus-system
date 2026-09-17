import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ReadingPracticeResults } from '@/components/readingPractice/ReadingPracticeResults';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import type { SessionResultsSummary } from '@/lib/readingPractice/types';
import { readingPracticeService } from '@/services/readingPracticeService';
import { paths } from '@/routes/paths';

export default function ReadingPracticeReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { student } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SessionResultsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || student?.exam_track !== 'toefl') {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void readingPracticeService
      .getReport(sessionId)
      .then((report) => {
        if (!cancelled) setSummary(report);
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
  }, [sessionId, student?.exam_track]);

  if (!student || student.exam_track !== 'toefl') {
    return (
      <Card className="p-6 text-sm">
        TOEFL Reading Practice only.{' '}
        <Link to={paths.settings} className="underline">
          Choose TOEFL
        </Link>
      </Card>
    );
  }

  if (loading) return <Spinner />;

  if (error || !summary) {
    return (
      <Card className="space-y-3 p-6 text-sm text-danger">
        <p>{error ?? 'Report not found.'}</p>
        <Link to={paths.readingPractice}>
          <Button variant="secondary">Back to practice hub</Button>
        </Link>
      </Card>
    );
  }

  return (
    <ReadingPracticeResults
      summary={summary}
      onSelectHistory={(id) => navigate(paths.readingPracticeReport(id))}
    />
  );
}
