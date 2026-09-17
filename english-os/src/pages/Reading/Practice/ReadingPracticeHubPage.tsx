import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExamTrackLogo } from '@/components/exam/ExamTrackLogo';
import { ReadingPracticeHistoryPanel } from '@/components/readingPractice/ReadingPracticeHistoryPanel';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { PRACTICE_MODE_SHORT } from '@/lib/readingPractice/mode';
import type { ReadingPracticeMode, SessionHistoryEntry } from '@/lib/readingPractice/types';
import { readingPracticeService } from '@/services/readingPracticeService';
import { paths } from '@/routes/paths';

const MODES: {
  mode: Exclude<ReadingPracticeMode, 'ADAPTIVE'>;
  title: string;
  description: string;
  fixedLength?: number;
}[] = [
  {
    mode: 'COMPLETE_WORDS',
    title: PRACTICE_MODE_SHORT.COMPLETE_WORDS,
    description:
      'Exactly 10 adaptive passages. Difficulty adjusts after each answer. Your score and estimated level appear as soon as you finish — no other sections mixed in.',
    fixedLength: 10,
  },
  {
    mode: 'DAILY_LIFE',
    title: PRACTICE_MODE_SHORT.DAILY_LIFE,
    description:
      'Notices, emails, menus, and practical reading — multiple-choice questions with its own scoring and results.',
  },
  {
    mode: 'ACADEMIC',
    title: PRACTICE_MODE_SHORT.ACADEMIC,
    description:
      'Academic passages with main idea, detail, and inference questions — separate session and results from Complete the Words.',
  },
];

const SESSION_LENGTHS = [5, 10, 15, 20] as const;

export default function ReadingPracticeHubPage() {
  const { student } = useAuth();
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState<ReadingPracticeMode | 'ALL'>('ALL');

  useEffect(() => {
    if (student?.exam_track !== 'toefl') {
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);

    void readingPracticeService
      .getHistory({ mode: modeFilter === 'ALL' ? undefined : modeFilter })
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [student?.exam_track, modeFilter]);

  if (!student || student.exam_track !== 'toefl') {
    return (
      <Card className="p-6 text-sm text-ink-muted">
        TOEFL Reading Practice is available only for students preparing for TOEFL. Choose TOEFL in{' '}
        <Link to={paths.settings} className="font-semibold text-ink underline">
          Settings
        </Link>
        .
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to={paths.reading} className="text-xs font-bold uppercase tracking-wide text-ink-subtle hover:text-ink">
          ← Back to Reading
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="page-title">TOEFL Reading Practice</h1>
          <ExamTrackLogo track="toefl" variant="badge" className="h-5 max-w-[72px]" />
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Three separate practice modes — Complete the Words (10 questions + results), Daily Life, and
          Academic. Each has its own session and report. Only you can see your past results.
        </p>
      </div>

      <div className="space-y-3">
        {MODES.map((m, i) => (
          <Card
            key={m.mode}
            className={i === 0 ? 'border-club/50 ring-1 ring-club/30' : undefined}
          >
            <CardHeader title={m.title} subtitle={m.description} />
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              {m.fixedLength != null ? (
                <Link to={`${paths.readingPracticeCheck}?mode=${m.mode}&length=${m.fixedLength}`}>
                  <Button size="sm" variant="primary">
                    Start 10-question test
                  </Button>
                </Link>
              ) : (
                SESSION_LENGTHS.map((len) => (
                  <Link key={len} to={`${paths.readingPracticeCheck}?mode=${m.mode}&length=${len}`}>
                    <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'}>
                      {len} questions
                    </Button>
                  </Link>
                ))
              )}
            </div>
          </Card>
        ))}
      </div>

      <ReadingPracticeHistoryPanel
        history={history}
        loading={historyLoading}
        modeFilter={modeFilter}
        onModeFilterChange={setModeFilter}
        reportHref={paths.readingPracticeReport}
        emptyMessage="Complete a session to see your history here."
      />
    </div>
  );
}
