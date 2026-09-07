import { cn } from '@/utils/cn';
import { ExamMobileTip } from '@/components/readingExam/ExamMobileTip';
import { paths } from '@/routes/paths';
import { useNavigate } from 'react-router-dom';
interface ToeflExamShellProps {
  children: React.ReactNode;
  onContinue?: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  showContinue?: boolean;
}

/** Full-screen TOEFL-style shell — Khawaja Club colors, no app nav. */
export function ToeflExamShell({
  children,
  onContinue,
  continueDisabled = false,
  continueLabel = 'Continue',
  showContinue = true,
}: ToeflExamShellProps) {
  const navigate = useNavigate();

  function exitTest() {
    if (window.confirm('Exit the reading test setup? Your progress on this screen will be lost.')) {
      navigate(paths.reading);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper-soft">
      <header className="flex items-center justify-between border-b border-ink/10 bg-ink px-4 py-3 text-club sm:px-6">
        <div>
          <p className="text-sm font-bold tracking-wide sm:text-base">Khawaja Club</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-club/80 sm:text-xs">
            TOEFL Reading · Setup
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-club/40 bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-paper-soft sm:text-sm"
            onClick={exitTest}
          >
            Exit Test
          </button>
          {showContinue && onContinue && (
            <button
              type="button"
              disabled={continueDisabled}
              className={cn(
                'inline-flex min-h-10 items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition sm:text-sm',
                continueDisabled
                  ? 'cursor-not-allowed border-club/50 bg-club/20 text-club/70'
                  : 'border-club bg-club text-ink hover:bg-club-hover',
              )}
              onClick={onContinue}
            >
              {continueLabel} →
            </button>
          )}
        </div>      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <ExamMobileTip />
    </div>
  );
}
