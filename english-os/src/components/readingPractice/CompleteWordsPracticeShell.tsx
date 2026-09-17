import type { Dispatch, SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { poolForDifficulty } from '@/lib/readingPractice/difficultyPools';
import type { StudentQuestionPayload } from '@/lib/readingPractice/types';
import { paths } from '@/routes/paths';
import { CompleteWordsHelpAssistant } from './CompleteWordsHelpAssistant';
import { CompleteWordsInlinePassage } from './CompleteWordsInlinePassage';

interface CompleteWordsPracticeShellProps {
  question: StudentQuestionPayload;
  blankAnswers: Record<number, string>;
  setBlankAnswers: Dispatch<SetStateAction<Record<number, string>>>;
  focusedBlankId: number | null;
  setFocusedBlankId: (id: number | null) => void;
  answeredCount: number;
  targetLength: number;
  busy: boolean;
  onContinue: () => void;
  continueLabel: string;
  canContinue: boolean;
}

export function CompleteWordsPracticeShell({
  question,
  blankAnswers,
  setBlankAnswers,
  focusedBlankId,
  setFocusedBlankId,
  answeredCount,
  targetLength,
  busy,
  onContinue,
  continueLabel,
  canContinue,
}: CompleteWordsPracticeShellProps) {
  const questionNumber = question.placementMeta?.questionNumber ?? answeredCount + 1;
  const totalQuestions = question.placementMeta?.totalQuestions ?? targetLength;
  const progressPercent = Math.min(100, Math.round((questionNumber / totalQuestions) * 100));
  const pool = poolForDifficulty(
    question.placementMeta?.sessionDifficulty ?? question.difficulty,
  );

  function handleClearAll() {
    if (busy) return;
    setBlankAnswers({});
  }

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-4 pb-24 sm:pb-20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Link
            to={paths.readingPractice}
            className="text-xs font-bold uppercase tracking-wide text-ink-subtle hover:text-ink"
          >
            ← Back to Reading
          </Link>
          <Link
            to={paths.readingPractice}
            className="text-xs font-semibold text-ink-muted hover:text-ink"
          >
            Exit Practice
          </Link>
        </div>

        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="border-b border-paper-line bg-paper-soft/40 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-subtle">
                  Reading Practice
                </p>
                <h1 className="font-display text-2xl text-ink sm:text-3xl">Complete the Words</h1>
                <p className="mt-1 text-sm text-ink-muted">
                  Fill in the missing letters to complete the words.
                </p>
              </div>
              <div className="min-w-[140px] space-y-2 text-right">
                <p className="text-xs font-semibold text-ink">
                  Question {questionNumber} of {totalQuestions}
                </p>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-paper-line"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progress: question ${questionNumber} of ${totalQuestions}`}
                >
                  <div
                    className="h-full rounded-full bg-club transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-club/35 bg-club-soft/60 px-2.5 py-0.5 text-xs font-bold text-ink">
                  Level {pool.pool}
                </span>
              </div>
            </div>
          </div>

          <div className="relative p-5 sm:p-6">
            {busy && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-lg bg-paper/70">
                <Spinner />
              </div>
            )}
            <CompleteWordsInlinePassage
              question={question}
              blankAnswers={blankAnswers}
              setBlankAnswers={setBlankAnswers}
              disabled={busy}
              onBlankFocus={setFocusedBlankId}
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={handleClearAll}
              >
                ↺ Clear All
              </Button>
              <Button
                variant="practiceContinue"
                onClick={onContinue}
                disabled={busy || !canContinue}
              >
                {continueLabel} →
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <CompleteWordsHelpAssistant
        question={question}
        blankAnswers={blankAnswers}
        focusedBlankId={focusedBlankId}
        disabled={busy}
      />
    </>
  );
}
