import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import type { WritingQuotaInfo } from '@/lib/writingPractice/types';
import { paths } from '@/routes/paths';
import { writingPracticeService } from '@/services/writingPracticeService';

export default function WritingPracticeHubPage() {
  const { student, isTeacher } = useAuth();
  const [quota, setQuota] = useState<WritingQuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (student?.exam_track !== 'toefl') {
      setLoading(false);
      return;
    }
    void writingPracticeService
      .quota()
      .then(setQuota)
      .finally(() => setLoading(false));
  }, [student?.exam_track]);

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="font-display text-3xl text-ink">Writing diagnostic</h1>
      <p className="text-sm text-ink-muted">
        10 Build a Sentence · 1 Email · 1 Academic Discussion · ~23 minutes. AI feedback is generated once
        after submit and cached — refreshing results does not call Gemini again.
      </p>

      {student?.exam_track === 'toefl' && quota && (
        <Card className="p-5">
          <p className="text-sm">
            Writing tests remaining: <strong>{quota.testsRemaining}</strong> (rolling 48 hours)
          </p>
          {quota.nextAvailableAt && quota.blocked && (
            <p className="mt-1 text-xs text-ink-muted">
              Next available test: {new Date(quota.nextAvailableAt).toLocaleString()}
            </p>
          )}
          {quota.blocked ? (
            <p className="mt-3 text-sm text-danger">You cannot start another Writing test yet.</p>
          ) : (
            <Link to={`${paths.writingPractice}/session`} className="mt-4 inline-block">
              <Button type="button">Start Writing test</Button>
            </Link>
          )}
        </Card>
      )}

      {isTeacher && (
        <Link to={paths.writingPracticeAdmin} className="text-sm font-bold uppercase text-ink-subtle">
          Manage writing diagnostic content →
        </Link>
      )}

      <Link to={paths.writing} className="text-xs underline text-ink-muted">
        ← Weekly writing assignments
      </Link>
    </div>
  );
}
