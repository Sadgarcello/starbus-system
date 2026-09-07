import { Button } from '@/components/ui/Button';
import { paths } from '@/routes/paths';
import { useNavigate } from 'react-router-dom';

interface ToeflExamShellProps {
  children: React.ReactNode;
  onContinue?: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  showContinue?: boolean;
}

/** Full-screen TOEFL-style shell — no app nav. */
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
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex items-center justify-between bg-[#9eb0d8] px-4 py-3 text-white sm:px-6">
        <p className="text-sm font-semibold tracking-wide sm:text-base">Khawaja Club · NT-016</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="border-white/40 bg-white text-ink hover:bg-paper-soft"
            onClick={exitTest}
          >
            Exit Test
          </Button>
          {showContinue && onContinue && (
            <Button
              type="button"
              size="sm"
              className="bg-[#5a7ab8] text-white hover:bg-[#4a6aa8] disabled:opacity-50"
              disabled={continueDisabled}
              onClick={onContinue}
            >
              {continueLabel} →
            </Button>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
