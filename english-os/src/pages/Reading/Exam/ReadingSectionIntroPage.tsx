import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ExamShell } from '@/components/readingExam/ExamStepParts';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import {
  isHardwareCheckComplete,
  markIntroSeen,
} from '@/lib/readingExam/examPrepStorage';
import { paths } from '@/routes/paths';

const TASK_ROWS = [
  {
    type: 'Complete the Words',
    description: 'Fill in the missing letters in a paragraph.',
  },
  {
    type: 'Read in Daily Life',
    description: 'Answer questions about everyday reading material.',
  },
  {
    type: 'Read an Academic Passage',
    description: 'Answer questions about academic passages.',
  },
] as const;

export default function ReadingSectionIntroPage() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get('mode') ?? 'ADAPTIVE';
  const length = params.get('length') ?? '10';
  const query = `mode=${encodeURIComponent(mode)}&length=${encodeURIComponent(length)}`;

  useEffect(() => {
    if (!isHardwareCheckComplete()) {
      navigate(`${paths.readingPracticeCheck}?${query}`, { replace: true });
    }
  }, [navigate, query]);

  if (!student || student.exam_track !== 'toefl') {
    return (
      <Card className="mx-auto max-w-lg p-6 text-sm">
        TOEFL Reading Practice only.{' '}
        <Link to={paths.settings} className="underline">
          Choose TOEFL
        </Link>
      </Card>
    );
  }

  function begin() {
    markIntroSeen();
    navigate(`${paths.readingPractice}/session?${query}`);
  }

  return (
    <ExamShell
      onContinue={begin}
      continueDisabled={false}
      continueLabel="Begin"
      showContinue
    >
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-10 w-1 shrink-0 rounded-full bg-club" />
          <h1 className="font-display text-3xl text-ink">Reading Section</h1>
        </div>

        <p className="text-base leading-relaxed text-ink-muted">
          In the reading section, you will answer questions to demonstrate how well you understand
          academic and non-academic texts in English. There are three types of tasks.
        </p>

        <div className="overflow-hidden rounded-md border border-paper-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-club/30 bg-club-soft text-ink">
                <th className="px-4 py-3 font-semibold">Type of Task</th>
                <th className="px-4 py-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {TASK_ROWS.map((row) => (
                <tr key={row.type} className="border-t border-paper-line">
                  <td className="px-4 py-3 font-medium text-ink">{row.type}</td>
                  <td className="px-4 py-3 text-ink-muted">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-base leading-relaxed text-ink-muted">
          This practice session includes <strong className="text-ink">{length} questions</strong>{' '}
          {mode === 'ADAPTIVE' ? (
            <>
              in three sections you will complete <strong className="text-ink">in order</strong>:
              Complete the Words, then Read in Daily Life, then Read an Academic Passage.
            </>
          ) : (
            <>
              focused on{' '}
              <strong className="text-ink">{mode.replace(/_/g, ' ').toLowerCase()}</strong>.
            </>
          )}{' '}
          Take your time and read each question carefully. Click{' '}
          <strong className="text-ink">Begin</strong> when you are ready to start.
        </p>

        <div className="flex justify-center pt-2 lg:hidden">
          <Button type="button" size="lg" onClick={begin}>
            Begin
          </Button>
        </div>
      </div>
    </ExamShell>
  );
}
