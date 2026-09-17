import { useEffect, useId, useRef, useState } from 'react';
import { buildCompleteWordsHint } from '@/lib/readingPractice/completeWordsHints';
import type { StudentQuestionPayload } from '@/lib/readingPractice/types';

const MASCOT_SRC = '/khawaja-club-logo.png';

interface CompleteWordsHelpAssistantProps {
  question: StudentQuestionPayload;
  blankAnswers: Record<number, string>;
  focusedBlankId: number | null;
  disabled?: boolean;
}

export function CompleteWordsHelpAssistant({
  question,
  blankAnswers,
  focusedBlankId,
  disabled = false,
}: CompleteWordsHelpAssistantProps) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;

    setHint(buildCompleteWordsHint(question, blankAnswers, focusedBlankId));

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, question, blankAnswers, focusedBlankId]);

  function handleToggle() {
    if (disabled) return;
    setOpen((prev) => !prev);
  }

  return (
    <div
      className="pointer-events-none fixed bottom-5 left-5 z-40 sm:bottom-6 sm:left-6"
      aria-live="polite"
    >
      {open && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-labelledby={`${popoverId}-title`}
          className="pointer-events-auto mb-3 max-w-[min(280px,calc(100vw-2.5rem))] rounded-xl border border-club/30 bg-paper px-4 py-3 shadow-lg"
        >
          <p id={`${popoverId}-title`} className="text-sm font-bold text-ink">
            Need a little help?
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{hint}</p>
          <button
            type="button"
            className="mt-3 w-full rounded-lg bg-club px-3 py-2 text-sm font-semibold text-ink transition hover:bg-club-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-club focus-visible:ring-offset-2"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
          >
            Got it
          </button>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label="Open reading help hints"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={handleToggle}
        className="group pointer-events-auto flex max-w-[210px] items-center gap-2 rounded-full border border-club/25 bg-paper/95 py-1 pl-1 pr-3 shadow-md backdrop-blur-sm transition hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-club focus-visible:ring-offset-2 disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 sm:max-w-[220px]"
      >
        <span className="relative shrink-0">
          <span
            className="pointer-events-none absolute -left-0.5 -top-1 h-3 w-0.5 rotate-[-24deg] rounded-full bg-club/70 motion-safe:animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-0.5 rotate-[18deg] rounded-full bg-club/60 motion-safe:animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute left-1/2 -top-1.5 h-2 w-0.5 -translate-x-1/2 rotate-[6deg] rounded-full bg-club/50 motion-safe:animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
          <img
            src={MASCOT_SRC}
            alt=""
            width={56}
            height={56}
            className="cw-help-idle h-12 w-12 rounded-full object-cover ring-2 ring-club/40 motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100 sm:h-14 sm:w-14"
          />
        </span>
        <span className="rounded-full bg-club-soft/80 px-3 py-1.5 text-sm font-semibold text-ink shadow-inner">
          Help me?
        </span>
      </button>
    </div>
  );
}
