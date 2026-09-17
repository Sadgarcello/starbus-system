import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import {
  resultLabel,
  studentFeedbackForErrorType,
  studentLabelForErrorType,
} from '@/lib/readingPractice/wordGrading';
import type { WordErrorType } from '@/lib/readingPractice/types';
import type {
  ChecklistResult,
  ReadingPracticeMode,
  ReadingQuestionType,
  ResultChecklistItem,
  SessionHistoryEntry,
  SessionResultsSummary,
} from '@/lib/readingPractice/types';
import { paths } from '@/routes/paths';

const MODE_LABEL: Record<ReadingPracticeMode, string> = {
  ADAPTIVE: 'Full reading practice',
  COMPLETE_WORDS: 'Complete the Words',
  DAILY_LIFE: 'Read in Daily Life',
  ACADEMIC: 'Read an Academic Passage',
};

const NAVY = '#111111';
const GOLD = '#FBBF24';

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function checklistResultLabel(result: ChecklistResult): string {
  if (result === 'correct' || result === 'incorrect') {
    return result === 'correct' ? 'Correct' : 'Incorrect';
  }
  return resultLabel(result);
}

function isChecklistCorrect(result: ChecklistResult): boolean {
  return result === 'correct';
}

function formatSkill(skill: string): string {
  return skill.replace(/_/g, ' ');
}

function placementScoreMessage(percent: number): string {
  if (percent >= 85) {
    return 'Strong diagnostic performance. Review word-level feedback below to see where you can improve.';
  }
  if (percent >= 65) {
    return 'Solid progress with room to grow. Check spelling and word-form feedback below.';
  }
  if (percent >= 45) {
    return 'Good effort — focus on the word breakdown below to target your practice.';
  }
  return 'Keep practicing. The breakdown below shows which words need the most work.';
}

function practiceScoreMessage(percent: number, correctCount: number, itemCount: number): string {
  if (percent >= 90) {
    return `Excellent — ${correctCount} of ${itemCount} correct.`;
  }
  if (percent >= 70) {
    return `Great job — ${correctCount} of ${itemCount} correct.`;
  }
  if (percent >= 50) {
    return 'Good effort. Review the questions below.';
  }
  return 'Keep practicing — focus on the areas below.';
}

function performanceRows(
  mode: ReadingPracticeMode,
  byType: SessionResultsSummary['byType'],
): { key: ReadingQuestionType; label: string; accuracy: number; total: number }[] {
  const all = [
    { key: 'COMPLETE_WORDS' as const, label: 'Complete the Words' },
    { key: 'DAILY_LIFE' as const, label: 'Daily Life' },
    { key: 'ACADEMIC' as const, label: 'Academic' },
  ];

  if (mode === 'COMPLETE_WORDS') {
    return [{ ...all[0], accuracy: byType.COMPLETE_WORDS.accuracy, total: byType.COMPLETE_WORDS.total }];
  }
  if (mode === 'DAILY_LIFE') {
    return [{ ...all[1], accuracy: byType.DAILY_LIFE.accuracy, total: byType.DAILY_LIFE.total }];
  }
  if (mode === 'ACADEMIC') {
    return [{ ...all[2], accuracy: byType.ACADEMIC.accuracy, total: byType.ACADEMIC.total }];
  }

  return all
    .map((row) => ({ ...row, accuracy: byType[row.key].accuracy, total: byType[row.key].total }))
    .filter((row) => row.total > 0);
}

function MiniScoreRing({ percent, size = 'md' }: { percent: number; size?: 'sm' | 'md' }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const dim = size === 'sm' ? 64 : 80;
  const radius = size === 'sm' ? 26 : 32;
  const stroke = size === 'sm' ? 6 : 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: dim, height: dim }}>
      <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${dim} ${dim}`} aria-hidden>
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-paper-line"
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke={GOLD}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-ink">{clamped}%</span>
      </div>
    </div>
  );
}

function ResultsHeader() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 text-white safe-pt"
      style={{ backgroundColor: NAVY }}
    >
      <Link
        to={paths.readingPractice}
        className="flex min-h-11 min-w-11 items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white"
      >
        <span aria-hidden>←</span>
        <span>Reading Practice</span>
      </Link>
      <Link
        to={paths.readingPractice}
        className="rounded-md border border-white/25 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
      >
        Practice Hub
      </Link>
    </header>
  );
}

function ScoreHeroCard({
  summary,
  isPlacement,
  scoreLabel,
  percent,
}: {
  summary: SessionResultsSummary;
  isPlacement: boolean;
  scoreLabel: string;
  percent: number;
}) {
  const placement = summary.placement;

  return (
    <section className="rounded-xl border border-paper-line bg-paper p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
          aria-hidden
        >
          ✓
        </span>
        <div>
          <h1 className="text-xl font-bold leading-tight text-ink sm:text-2xl">Quiz Complete!</h1>
          <p className="text-sm text-ink-muted">
            {isPlacement
              ? 'Your adaptive 10-question test is complete.'
              : 'Here is your result for this session'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-lg bg-paper-soft/80 p-4">
        <MiniScoreRing percent={percent} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold leading-none text-ink sm:text-4xl">{scoreLabel}</p>
          <p className="mt-1 text-lg font-semibold text-ink-muted">{percent}%</p>
          <p className="mt-2 text-sm text-ink-muted">
            {isPlacement
              ? placementScoreMessage(percent)
              : practiceScoreMessage(percent, summary.fullMarks, summary.itemCount)}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {isPlacement && placement ? (
          <>
            <div>
              <dt className="text-xs text-ink-subtle">Diagnostic score</dt>
              <dd className="font-semibold text-ink">{formatPoints(placement.overallScoreOutOf100)}/100</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-subtle">Estimated proficiency</dt>
              <dd className="font-semibold text-ink">{placement.estimatedLevel}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-subtle">Highest difficulty tested</dt>
              <dd className="font-semibold text-ink">{Math.round(placement.difficultyReached)}/10</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-subtle">Questions completed</dt>
              <dd className="font-semibold text-ink">{summary.questions}/10</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt className="text-xs text-ink-subtle">Level</dt>
              <dd className="font-semibold text-ink">{summary.studentLevel}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-subtle">Difficulty</dt>
              <dd className="font-semibold text-ink">
                {summary.startingDifficulty.toFixed(1)} → {summary.endingDifficulty.toFixed(1)}
              </dd>
            </div>
          </>
        )}
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-ink-subtle">Completed</dt>
          <dd className="font-medium text-ink-muted">{formatDate(summary.completedAt)}</dd>
        </div>
      </dl>

      {isPlacement && (
        <p className="mt-3 text-xs text-ink-subtle">
          Tap a question below to inspect each word score. Highest difficulty is the hardest passage
          served, not an average.
        </p>
      )}
    </section>
  );
}

function PerformanceCard({
  mode,
  byType,
  weakestSkill,
}: {
  mode: ReadingPracticeMode;
  byType: SessionResultsSummary['byType'];
  weakestSkill: string | null;
}) {
  const rows = performanceRows(mode, byType);
  if (rows.length === 0 && !weakestSkill) return null;

  return (
    <section className="rounded-xl border border-paper-line bg-paper p-4 shadow-sm">
      <h2 className="text-sm font-bold text-ink">Performance</h2>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-ink">{row.label}</span>
              <span className="tabular-nums font-semibold text-ink-muted">{row.accuracy}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-line">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, row.accuracy)}%`, backgroundColor: GOLD }}
              />
            </div>
          </li>
        ))}
      </ul>
      {weakestSkill && (
        <p className="mt-3 rounded-md border border-danger/15 bg-danger/5 px-3 py-2 text-sm text-danger">
          <span className="font-semibold">Needs practice:</span> {formatSkill(weakestSkill)}
        </p>
      )}
    </section>
  );
}

function PlacementQuestionCard({ item }: { item: ResultChecklistItem }) {
  const [open, setOpen] = useState(false);
  const words = item.words ?? [];

  return (
    <article className="rounded-lg border border-paper-line bg-paper-soft/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => words.length > 0 && setOpen((v) => !v)}
          className={`text-left font-bold text-ink ${words.length > 0 ? 'underline decoration-dotted' : ''}`}
        >
          Question {item.number}
          {words.length > 0 ? (open ? ' ▾' : ' ▸') : ''}
        </button>
        {item.passageScore != null && (
          <span className="shrink-0 rounded-full bg-club-soft/40 px-2 py-0.5 text-xs font-semibold text-ink">
            Passage score {Math.round(item.passageScore)}%
          </span>
        )}
      </div>

      {item.difficulty != null && (
        <p className="mt-1 text-xs text-ink-subtle">Difficulty {Math.round(item.difficulty)}/10</p>
      )}

      {open && words.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-paper-line pt-3 text-xs">
          {words.map((word) => (
            <div
              key={`${item.number}-${word.targetWord}-${word.studentAnswer}`}
              className="rounded-md bg-paper-soft/70 px-2 py-1.5"
            >
              <p className="font-semibold text-ink">
                {word.correctAnswer} → {word.studentAnswer}
              </p>
              <p className="text-ink-muted">
                {Math.round(word.wordScore)}% · {studentLabelForErrorType(word.errorType)}
              </p>
              <p className="mt-0.5 text-ink-subtle">
                {word.feedback ?? studentFeedbackForErrorType(word.errorType)}
              </p>
            </div>
          ))}
          {(item.sessionDifficultyBefore != null || item.classification) && (
            <p className="text-ink-subtle">
              Next difficulty {Math.round(item.sessionDifficultyBefore ?? 0)} →{' '}
              {Math.round(item.sessionDifficultyAfter ?? 0)}
              {item.classification ? ` · ${item.classification}` : ''}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function QuestionReviewCard({ item }: { item: ResultChecklistItem }) {
  const correct = isChecklistCorrect(item.result);

  return (
    <article
      className={`rounded-lg border p-3 ${
        correct ? 'border-success/25 bg-success/[0.04]' : 'border-danger/25 bg-danger/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-ink">Q{item.number}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            correct ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
          }`}
        >
          {correct ? '✓ Correct' : '✕ Incorrect'}
        </span>
      </div>
      {item.sectionLabel && (
        <p className="mt-0.5 text-xs text-ink-subtle">{item.sectionLabel}</p>
      )}
      <div className="mt-2 space-y-2.5 text-sm">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-subtle">Your answer</p>
          <p className="break-words text-ink">{item.yourAnswer || '—'}</p>
        </div>
        {!correct && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-subtle">Correct answer</p>
            <p className="break-words text-ink">{item.correctAnswer || '—'}</p>
          </div>
        )}
      </div>
    </article>
  );
}

function QuestionReviewSection({
  checklist,
  isPlacement,
}: {
  checklist: ResultChecklistItem[];
  isPlacement: boolean;
}) {
  if (checklist.length === 0) {
    return (
      <section className="rounded-xl border border-paper-line bg-paper p-4 text-sm text-ink-muted shadow-sm">
        <h2 className="font-bold text-ink">Question Review</h2>
        <p className="mt-2">No graded items in this report.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-paper-line bg-paper shadow-sm">
      <div className="border-b border-paper-line px-4 py-3">
        <h2 className="text-sm font-bold text-ink">Question Review</h2>
        <p className="mt-0.5 text-xs text-ink-muted">{checklist.length} questions</p>
      </div>

      {/* Mobile + tablet: stacked cards */}
      <div className="space-y-2 p-3 lg:hidden">
        {checklist.map((item) =>
          isPlacement ? (
            <PlacementQuestionCard key={item.number} item={item} />
          ) : (
            <QuestionReviewCard key={item.number} item={item} />
          ),
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden max-h-[28rem] overflow-auto lg:block">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-paper">
            <tr className="border-b border-paper-line text-left text-xs uppercase tracking-wide text-ink-subtle">
              <th className="px-4 py-2 font-bold">Q #</th>
              {isPlacement && <th className="px-4 py-2 font-bold">Difficulty</th>}
              <th className="px-4 py-2 font-bold">Your answer</th>
              <th className="px-4 py-2 font-bold">Correct answer</th>
              <th className="px-4 py-2 font-bold">Result</th>
            </tr>
          </thead>
          <tbody>
            {checklist.map((item) => (
              <DesktopChecklistRow key={item.number} item={item} isPlacement={isPlacement} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DesktopChecklistRow({
  item,
  isPlacement,
}: {
  item: ResultChecklistItem;
  isPlacement: boolean;
}) {
  const [open, setOpen] = useState(false);
  const words = item.words ?? [];

  if (isPlacement && words.length > 0) {
    return (
      <>
        <tr className="border-b border-paper-line/70">
          <td className="px-4 py-2.5 font-semibold text-ink">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-left underline decoration-dotted underline-offset-2 hover:text-club"
            >
              {item.number}
              {open ? ' ▾' : ' ▸'}
            </button>
          </td>
          <td className="px-4 py-2.5 text-ink-muted">{item.difficulty != null ? Math.round(item.difficulty) : '—'}</td>
          <td className="max-w-xs px-4 py-2.5 break-words text-ink">{item.yourAnswer}</td>
          <td className="max-w-xs px-4 py-2.5 break-words text-ink">{item.correctAnswer}</td>
          <td className="px-4 py-2.5 font-semibold text-ink">
            {item.passageScore != null ? `${Math.round(item.passageScore)}%` : checklistResultLabel(item.result)}
          </td>
        </tr>
        {open && (
          <tr className="border-b border-paper-line/70 bg-ink/[0.03]">
            <td colSpan={5} className="px-4 py-3">
              <WordBreakdownList item={item} />
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <tr className="border-b border-paper-line/70">
      <td className="px-4 py-2.5 font-semibold text-ink">{item.number}</td>
      {isPlacement && (
        <td className="px-4 py-2.5 text-ink-muted">{item.difficulty != null ? Math.round(item.difficulty) : '—'}</td>
      )}
      <td className="max-w-xs px-4 py-2.5 break-words text-ink">{item.yourAnswer}</td>
      <td className="max-w-xs px-4 py-2.5 break-words text-ink">{item.correctAnswer}</td>
      <td className="px-4 py-2.5 font-semibold text-ink">{checklistResultLabel(item.result)}</td>
    </tr>
  );
}

function WordBreakdownList({ item }: { item: ResultChecklistItem }) {
  const words = item.words ?? [];
  return (
    <div className="space-y-2 text-sm">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-ink-subtle">
            <th className="pb-1 pr-3 font-bold">Word</th>
            <th className="pb-1 pr-3 font-bold">Your answer</th>
            <th className="pb-1 pr-3 font-bold">Correct</th>
            <th className="pb-1 pr-3 font-bold">Score</th>
            <th className="pb-1 font-bold">Type</th>
          </tr>
        </thead>
        <tbody>
          {words.map((word) => (
            <tr key={`${item.number}-${word.targetWord}-${word.studentAnswer}`}>
              <td className="py-1 pr-3 font-medium text-ink">{word.targetWord}</td>
              <td className="py-1 pr-3 text-ink">{word.studentAnswer}</td>
              <td className="py-1 pr-3 text-ink">{word.correctAnswer}</td>
              <td className="py-1 pr-3 text-ink">{Math.round(word.wordScore)}%</td>
              <td className="py-1 text-ink-muted">{studentLabelForErrorType(word.errorType)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function reviewGroupLabel(errorType?: WordErrorType, result?: string): string {
  if (
    errorType === 'MINOR_SPELLING' ||
    errorType === 'MODERATE_SPELLING' ||
    errorType === 'MAJOR_RECOGNIZABLE_SPELLING' ||
    result === 'misspelling'
  ) {
    return 'Spelling';
  }
  if (errorType === 'WORD_FORM_OR_WORD_FAMILY') return 'Word form';
  if (errorType === 'MISSING' || result === 'blank') return 'Missing';
  return 'Incorrect word';
}

function WordsToReviewSection({
  missedWords,
  showSection,
}: {
  missedWords: SessionResultsSummary['missedWords'];
  showSection: boolean;
}) {
  if (!showSection) return null;

  if (missedWords.length === 0) {
    return (
      <section className="rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
        All Complete the Words answers were exact.
      </section>
    );
  }

  const groups = new Map<string, typeof missedWords>();
  for (const entry of missedWords) {
    const label = reviewGroupLabel(entry.errorType, entry.result);
    const list = groups.get(label) ?? [];
    list.push(entry);
    groups.set(label, list);
  }

  const groupOrder = ['Spelling', 'Word form', 'Incorrect word', 'Missing'];

  return (
    <section className="rounded-xl border border-paper-line bg-paper p-4 shadow-sm">
      <h2 className="text-sm font-bold text-ink">Words to Review</h2>
      <div className="mt-3 space-y-4 text-sm">
        {groupOrder
          .filter((label) => groups.has(label))
          .map((label) => (
            <div key={label}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-subtle">{label}</h3>
              <ul className="mt-2 space-y-2">
                {(groups.get(label) ?? []).map((entry) => (
                  <li
                    key={`${entry.itemNumber ?? entry.word}-${entry.submitted ?? 'blank'}`}
                    className="rounded-md border border-paper-line bg-paper-soft/50 px-3 py-2"
                  >
                    <span className="font-semibold text-ink">
                      {entry.itemNumber != null ? `Q${entry.itemNumber} · ` : ''}
                      {entry.word}
                    </span>
                    <span className="mt-0.5 block break-words text-ink-muted">
                      Your answer: {entry.submitted ?? 'blank'}
                      {entry.wordScore != null ? ` · ${Math.round(entry.wordScore)}%` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </section>
  );
}

function PastAttemptsSection({
  history,
  currentSessionId,
  onSelect,
}: {
  history: SessionHistoryEntry[];
  currentSessionId: string;
  onSelect?: (sessionId: string) => void;
}) {
  if (!history.length) return null;

  return (
    <section className="rounded-xl border border-paper-line bg-paper shadow-sm">
      <div className="border-b border-paper-line px-4 py-3">
        <h2 className="text-sm font-bold text-ink">Past Attempts</h2>
        <p className="mt-0.5 text-xs text-ink-muted">Compare your score with earlier sessions.</p>
      </div>

      {/* Mobile / tablet cards */}
      <div className="space-y-2 p-3 lg:hidden">
        {history.map((entry) => {
          const isCurrent = entry.sessionId === currentSessionId;
          return (
            <article
              key={entry.sessionId}
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                isCurrent ? 'border-club/40 bg-club-soft/30' : 'border-paper-line bg-paper-soft/30'
              }`}
            >
              <p className="text-xs text-ink-muted">{formatDateShort(entry.completedAt)}</p>
              <p className="mt-0.5 font-semibold text-ink">{MODE_LABEL[entry.mode]}</p>
              <p className="mt-1 font-medium text-ink">
                {formatPoints(entry.totalPoints)}/{entry.maxPoints} · {entry.accuracyPercent}%
              </p>
              <p className="text-xs text-ink-subtle">Level {entry.studentLevel}</p>
              <div className="mt-2">
                {isCurrent ? (
                  <span className="text-xs font-bold uppercase text-club">This session</span>
                ) : onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(entry.sessionId)}
                    className="min-h-11 text-xs font-semibold text-ink underline hover:text-club"
                  >
                    View report
                  </button>
                ) : (
                  <Link
                    to={paths.readingPracticeReport(entry.sessionId)}
                    className="inline-flex min-h-11 items-center text-xs font-semibold text-ink underline hover:text-club"
                  >
                    View report
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-paper-line bg-ink/5 text-left text-xs uppercase tracking-wide text-ink-subtle">
              <th className="px-4 py-2 font-bold">Date</th>
              <th className="px-4 py-2 font-bold">Level</th>
              <th className="px-4 py-2 font-bold">Score</th>
              <th className="px-4 py-2 font-bold">Mode</th>
              <th className="px-4 py-2 font-bold" />
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => {
              const isCurrent = entry.sessionId === currentSessionId;
              return (
                <tr
                  key={entry.sessionId}
                  className={`border-b border-paper-line/70 ${isCurrent ? 'bg-club-soft/50' : ''}`}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(entry.completedAt)}</td>
                  <td className="px-4 py-2.5">{entry.studentLevel}</td>
                  <td className="px-4 py-2.5">
                    {formatPoints(entry.totalPoints)}/{entry.maxPoints} ({entry.accuracyPercent}%)
                  </td>
                  <td className="px-4 py-2.5">{MODE_LABEL[entry.mode]}</td>
                  <td className="px-4 py-2.5 text-right">
                    {isCurrent ? (
                      <span className="text-xs font-bold uppercase text-club">This session</span>
                    ) : onSelect ? (
                      <button
                        type="button"
                        onClick={() => onSelect(entry.sessionId)}
                        className="text-xs font-semibold text-ink underline hover:text-club"
                      >
                        View
                      </button>
                    ) : (
                      <Link
                        to={paths.readingPracticeReport(entry.sessionId)}
                        className="text-xs font-semibold text-ink underline hover:text-club"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResultsActions({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
      {onRetry && (
        <Button variant="practiceContinue" onClick={onRetry} className="min-h-11 w-full sm:flex-1">
          Try Again
        </Button>
      )}
      <Link to={paths.reading} className={onRetry ? 'w-full sm:flex-1' : 'w-full'}>
        <Button variant="secondary" className="min-h-11 w-full">
          Back to Reading
        </Button>
      </Link>
    </div>
  );
}

export function ReadingPracticeResults({
  summary,
  onRetry,
  onSelectHistory,
}: {
  summary: SessionResultsSummary;
  onRetry?: () => void;
  onSelectHistory?: (sessionId: string) => void;
}) {
  const checklist = summary.checklist ?? [];
  const missedWords = summary.missedWords ?? [];
  const history = summary.history ?? [];
  const placement = summary.placement;
  const isPlacement = summary.mode === 'COMPLETE_WORDS' && placement != null;
  const showWordsSection = summary.mode === 'COMPLETE_WORDS' || isPlacement;
  const scoreLabel =
    placement?.overallScoreOutOf100 != null
      ? `${formatPoints(placement.overallScoreOutOf100)}/100`
      : placement?.passageScore ?? `${formatPoints(summary.totalPoints)}/${summary.maxPoints}`;
  const percent = summary.accuracyPercent ?? summary.accuracy ?? 0;

  return (
    <div className="min-h-dvh bg-paper-soft">
      <ResultsHeader />

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-8 sm:space-y-5 sm:py-5">
        <ScoreHeroCard summary={summary} isPlacement={isPlacement} scoreLabel={scoreLabel} percent={percent} />

        {!isPlacement && (
          <PerformanceCard
            mode={summary.mode}
            byType={summary.byType}
            weakestSkill={summary.weakestSkill}
          />
        )}

        <QuestionReviewSection checklist={checklist} isPlacement={isPlacement} />

        <WordsToReviewSection missedWords={missedWords} showSection={showWordsSection} />

        <PastAttemptsSection
          history={history}
          currentSessionId={summary.sessionId}
          onSelect={onSelectHistory}
        />

        <ResultsActions onRetry={onRetry} />

        <p className="text-center text-xs text-ink-subtle">
          Practice performance only — your official CEFR level is set by Khawaja Club assessment.
        </p>
      </div>
    </div>
  );
}
