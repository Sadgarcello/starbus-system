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
import { normalizePracticeMode, PRACTICE_MODE_SHORT } from '@/lib/readingPractice/mode';
import { paths } from '@/routes/paths';

const MODE_COPY: Record<
  Exclude<ReturnType<typeof normalizePracticeMode>, 'ADAPTIVE'>,
  { lead: string; detail: string }
> = {
  COMPLETE_WORDS: {
    lead: 'Complete the Words',
    detail:
      'You will answer exactly 10 passages. Fill in the missing letters in each paragraph. Difficulty adapts as you go. When you finish question 10, you go straight to your results — score, estimated level, and words to review.',
  },
  DAILY_LIFE: {
    lead: 'Read in Daily Life',
    detail:
      'You will read everyday material (notices, emails, menus) and answer multiple-choice questions. Results appear when you finish this session only.',
  },
  ACADEMIC: {
    lead: 'Read an Academic Passage',
    detail:
      'You will read academic-style passages and answer multiple-choice questions about main ideas, details, and inference. Results appear when you finish this session only.',
  },
};

export default function ReadingSectionIntroPage() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawMode = params.get('mode');
  const mode = normalizePracticeMode(rawMode);
  const length = params.get('length') ?? (mode === 'COMPLETE_WORDS' ? '10' : '10');
  const query = `mode=${encodeURIComponent(mode)}&length=${encodeURIComponent(length)}`;
  const copy = MODE_COPY[mode as keyof typeof MODE_COPY];

  useEffect(() => {
    if (rawMode === 'ADAPTIVE') {
      navigate(`${paths.readingPracticeIntro}?mode=COMPLETE_WORDS&length=${encodeURIComponent(length)}`, {
        replace: true,
      });
      return;
    }
    if (!isHardwareCheckComplete()) {
      navigate(`${paths.readingPracticeCheck}?${query}`, { replace: true });
    }
  }, [navigate, query, rawMode, length]);

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
          <h1 className="font-display text-3xl text-ink">{copy.lead}</h1>
        </div>

        <p className="text-base leading-relaxed text-ink-muted">{copy.detail}</p>

        <p className="rounded-md border border-paper-line bg-paper-soft/60 px-4 py-3 text-sm text-ink-muted">
          <strong className="text-ink">{PRACTICE_MODE_SHORT[mode as keyof typeof PRACTICE_MODE_SHORT]}</strong>{' '}
          is separate from the other TOEFL reading task types. Start each mode from the Reading Practice
          hub when you want to practice it.
        </p>

        <p className="text-base leading-relaxed text-ink-muted">
          This session has{' '}
          <strong className="text-ink">
            {mode === 'COMPLETE_WORDS' ? '10' : length} question{mode === 'COMPLETE_WORDS' ? 's' : Number(length) === 1 ? '' : 's'}
          </strong>
          . Take your time and read carefully. Click <strong className="text-ink">Begin</strong> when you
          are ready.
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
