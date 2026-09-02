import { Link } from 'react-router-dom';
import { ExamTrackLogo } from '@/components/exam/ExamTrackLogo';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { paths } from '@/routes/paths';
import type { ReadingPracticeMode } from '@/lib/readingPractice/types';

const MODES: { mode: ReadingPracticeMode; title: string; description: string }[] = [
  {
    mode: 'ADAPTIVE',
    title: 'Adaptive Reading Practice',
    description: 'Recommended — the engine picks tasks based on your weaknesses.',
  },
  {
    mode: 'COMPLETE_WORDS',
    title: 'Complete the Words',
    description: 'Vocabulary, spelling, and context in academic sentences.',
  },
  {
    mode: 'DAILY_LIFE',
    title: 'Read in Daily Life',
    description: 'Notices, emails, menus, and practical reading.',
  },
  {
    mode: 'ACADEMIC',
    title: 'Read an Academic Passage',
    description: 'Longer passages with main idea, detail, and inference questions.',
  },
];

const SESSION_LENGTHS = [5, 10, 15, 20] as const;

export default function ReadingPracticeHubPage() {
  const { student } = useAuth();

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
          Adaptive practice engine — no AI during sessions. Your official level comes from Khawaja Club
          assessment; practice adapts separately.
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
              {SESSION_LENGTHS.map((len) => (
                <Link key={len} to={`${paths.readingPractice}/session?mode=${m.mode}&length=${len}`}>
                  <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'}>
                    {len} questions
                  </Button>
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Take actual test"
          subtitle="Full adaptive session — mixed Complete the Words, Daily Life, and Academic passages."
        />
        <div className="px-4 pb-4">
          <Link to={`${paths.readingPractice}/session?mode=ADAPTIVE&length=10`}>
            <Button className="w-full sm:w-auto">Start 10-question adaptive test</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
