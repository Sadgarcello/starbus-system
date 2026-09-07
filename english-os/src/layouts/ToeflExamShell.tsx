import { Button } from '@/components/ui/Button';
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="border-club/30 bg-paper text-ink hover:bg-paper-soft"
            onClick={exitTest}
          >
            Exit Test
          </Button>
          {showContinue && onContinue && (
            <Button
              type="button"
              size="sm"
              className="border border-club bg-club text-ink hover:bg-club-hover disabled:opacity-50"
              disabled={continueDisabled}
              onClick={onContinue}
            >
              {continueLabel} →
            </Button>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <ExamMobileTip />
    </div>
  );
}
