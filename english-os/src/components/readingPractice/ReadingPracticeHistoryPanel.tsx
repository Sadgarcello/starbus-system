import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { PRACTICE_MODE_SHORT } from '@/lib/readingPractice/mode';
import type { ReadingPracticeMode, SessionHistoryEntry } from '@/lib/readingPractice/types';

const MODE_FILTERS: { value: ReadingPracticeMode | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All modes' },
  { value: 'COMPLETE_WORDS', label: PRACTICE_MODE_SHORT.COMPLETE_WORDS },
  { value: 'DAILY_LIFE', label: PRACTICE_MODE_SHORT.DAILY_LIFE },
  { value: 'ACADEMIC', label: PRACTICE_MODE_SHORT.ACADEMIC },
];

const MODE_LABEL: Record<ReadingPracticeMode, string> = {
  ADAPTIVE: 'Full practice (legacy)',
  COMPLETE_WORDS: PRACTICE_MODE_SHORT.COMPLETE_WORDS,
  DAILY_LIFE: PRACTICE_MODE_SHORT.DAILY_LIFE,
  ACADEMIC: PRACTICE_MODE_SHORT.ACADEMIC,
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function ReadingPracticeHistoryPanel({
  history,
  loading,
  modeFilter,
  onModeFilterChange,
  reportHref,
  emptyMessage = 'Complete a session to see results here.',
}: {
  history: SessionHistoryEntry[];
  loading: boolean;
  modeFilter: ReadingPracticeMode | 'ALL';
  onModeFilterChange: (mode: ReadingPracticeMode | 'ALL') => void;
  reportHref: (sessionId: string) => string;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-paper-line bg-paper shadow-sm">
      <div className="border-b border-paper-line px-4 py-3">
        <h2 className="text-sm font-bold text-ink">Past results</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Latest and older sessions — tap a row to open the full report.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODE_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={modeFilter === filter.value ? 'primary' : 'secondary'}
              onClick={() => onModeFilterChange(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-6">
          <Spinner />
        </div>
      ) : history.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-muted">{emptyMessage}</p>
      ) : (
        <>
          <div className="space-y-2 p-3 lg:hidden">
            {history.map((entry) => (
              <article
                key={entry.sessionId}
                className="rounded-lg border border-paper-line bg-paper-soft/30 px-3 py-2.5 text-sm"
              >
                <p className="text-xs text-ink-muted">{formatDate(entry.completedAt)}</p>
                <p className="mt-0.5 font-semibold text-ink">{MODE_LABEL[entry.mode]}</p>
                <p className="mt-1 font-medium text-ink">
                  {entry.totalPoints}/{entry.maxPoints} · {entry.accuracyPercent}%
                </p>
                <p className="text-xs text-ink-subtle">Level {entry.studentLevel}</p>
                <Link
                  to={reportHref(entry.sessionId)}
                  className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-ink underline hover:text-club"
                >
                  View report
                </Link>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-paper-line bg-ink/5 text-left text-xs uppercase tracking-wide text-ink-subtle">
                  <th className="px-4 py-2 font-bold">Date</th>
                  <th className="px-4 py-2 font-bold">Mode</th>
                  <th className="px-4 py-2 font-bold">Level</th>
                  <th className="px-4 py-2 font-bold">Score</th>
                  <th className="px-4 py-2 font-bold" />
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.sessionId} className="border-b border-paper-line/70">
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(entry.completedAt)}</td>
                    <td className="px-4 py-2.5">{MODE_LABEL[entry.mode]}</td>
                    <td className="px-4 py-2.5">{entry.studentLevel}</td>
                    <td className="px-4 py-2.5">
                      {entry.totalPoints}/{entry.maxPoints} ({entry.accuracyPercent}%)
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={reportHref(entry.sessionId)}
                        className="text-xs font-semibold text-ink underline hover:text-club"
                      >
                        View report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
