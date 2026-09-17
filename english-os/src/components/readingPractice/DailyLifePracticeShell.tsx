import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { StudentQuestionPayload } from '@/lib/readingPractice/types';
import { paths } from '@/routes/paths';
import { DailyLifeContentPanel } from './DailyLifeContentPanel';

/** Khawaja Club yellow for Read in Daily Life UI */
const DL_YELLOW = '#FBBF24';
const DL_YELLOW_HEADER = '#FFFBEB';

type McqKey = 'A' | 'B' | 'C' | 'D';

interface DailyLifePracticeShellProps {
  question: StudentQuestionPayload;
  mcq: McqKey | null;
  setMcq: (value: McqKey) => void;
  answeredCount: number;
  targetLength: number;
  busy: boolean;
  onContinue: () => void;
  continueLabel?: string;
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6h8M6 9.5h8M6 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 2.5a5 5 0 0 0-2.5 9.32V13a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1.18A5 5 0 0 0 10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8.5 16h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function McqOption({
  optionKey,
  label,
  selected,
  disabled,
  onSelect,
}: {
  optionKey: McqKey;
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`group flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left text-sm transition touch-manipulation sm:text-[15px] ${
        selected
          ? 'border-[#FBBF24] bg-[#FEF3C7] shadow-[0_0_0_1px_rgba(251,191,36,0.35)]'
          : 'border-paper-line bg-paper hover:border-ink/25 hover:shadow-sm'
      } ${disabled ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
          selected
            ? 'border-[#FBBF24] bg-[#FBBF24]'
            : 'border-paper-line bg-paper group-hover:border-ink/30'
        }`}
        aria-hidden
      >
        {selected && <span className="h-2 w-2 rounded-full bg-ink" />}
      </span>
      <span className="leading-relaxed text-ink">
        <strong className="font-bold">{optionKey}.</strong> {label}
      </span>
    </button>
  );
}

export function DailyLifePracticeShell({
  question,
  mcq,
  setMcq,
  answeredCount,
  targetLength,
  busy,
  onContinue,
  continueLabel,
}: DailyLifePracticeShellProps) {
  const questionNumber = answeredCount + 1;
  const progressPercent = Math.min(100, Math.round((questionNumber / targetLength) * 100));
  const options = question.options ?? [];
  const locked = busy;
  const contextQuestionIndex = question.questionIndex ?? 1;
  const contextQuestionTotal = question.questionsInContext ?? 1;
  const multiQuestionContext = contextQuestionTotal > 1;
  const levelLabel = Number.isFinite(question.difficulty)
    ? `Level ${Math.round(question.difficulty)}`
    : null;

  const actionLabel =
    continueLabel ??
    (busy ? 'Saving…' : answeredCount + 1 >= targetLength ? 'Finish' : 'Continue');

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-1 pb-10 sm:px-0">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink"
            style={{ backgroundColor: DL_YELLOW }}
          >
            <DocumentIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              Read in Daily Life
            </p>
            <p className="text-sm font-semibold text-ink">
              Question {questionNumber} of {targetLength}
            </p>
            {multiQuestionContext && (
              <p className="mt-0.5 text-xs font-medium text-ink-muted">
                Question {contextQuestionIndex} of {contextQuestionTotal} about this text
              </p>
            )}
            {levelLabel && (
              <p className="mt-0.5 text-xs text-ink-subtle">{levelLabel}</p>
            )}
          </div>
        </div>

        <div className="flex min-w-[160px] flex-1 flex-col items-end gap-2 sm:max-w-[220px]">
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-xs font-semibold tabular-nums text-ink-muted">{progressPercent}%</span>
            <Link
              to={paths.reading}
              className="text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Exit Practice
            </Link>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-paper-line"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress: question ${questionNumber} of ${targetLength}`}
          >
            <div
              className="h-full rounded-full transition-all duration-500 motion-reduce:transition-none"
              style={{ width: `${progressPercent}%`, backgroundColor: DL_YELLOW }}
            />
          </div>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        {busy && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-paper/60 backdrop-blur-[1px]">
            <Spinner />
          </div>
        )}

        <section aria-label="Reading passage" className="min-w-0">
          <DailyLifeContentPanel
            title={question.title}
            content={question.content}
            contentType={question.contentType}
          />
        </section>

        <section
          aria-label="Comprehension question"
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-paper-line bg-paper shadow-sm"
        >
          <div
            className="border-b px-5 py-4"
            style={{ borderColor: `${DL_YELLOW}40`, backgroundColor: DL_YELLOW_HEADER }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink"
                style={{ backgroundColor: DL_YELLOW }}
              >
                <LightbulbIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Comprehension Question</p>
                <p className="mt-0.5 text-xs italic text-ink-muted">
                  Read the text carefully and choose the best answer.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col px-5 py-5 sm:px-6">
            <h3 className="font-display text-lg leading-snug text-ink sm:text-xl">
              {question.questionText}
            </h3>

            <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Answer choices">
              {options.map((o) => (
                <McqOption
                  key={o.key}
                  optionKey={o.key}
                  label={o.label}
                  selected={mcq === o.key}
                  disabled={locked}
                  onSelect={() => setMcq(o.key)}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-end border-t border-paper-line pt-5">
              <Button
                variant="gold"
                onClick={onContinue}
                disabled={busy || mcq === null}
                className="min-w-[170px]"
              >
                {actionLabel} →
              </Button>
            </div>
          </div>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-paper-line pt-4 text-xs text-ink-subtle">
        <p>English for a brighter tomorrow</p>
        <p className="font-semibold">Khawaja Club English Club</p>
      </footer>
    </div>
  );
}
