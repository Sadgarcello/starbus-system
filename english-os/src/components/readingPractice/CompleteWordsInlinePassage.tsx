import { useEffect, useMemo, useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import type { StudentQuestionPayload } from '@/lib/readingPractice/types';
import { buildPassageSegments } from '@/lib/readingPractice/completeWords';

export function CompleteWordsInlinePassage({
  question,
  blankAnswers,
  setBlankAnswers,
  disabled,
}: {
  question: StudentQuestionPayload;
  blankAnswers: Record<number, string>;
  setBlankAnswers: Dispatch<SetStateAction<Record<number, string>>>;
  disabled: boolean;
}) {
  const passage = question.displayPassage ?? question.displaySentence ?? '';
  const blanks = question.blanks ?? [];
  const segments = useMemo(() => buildPassageSegments(passage, blanks), [passage, blanks]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (disabled || blanks.length === 0) return;
    inputRefs.current[0]?.focus();
  }, [question.questionId, disabled, blanks.length]);

  function focusBlank(index: number) {
    if (index < 0 || index >= blanks.length) return;
    inputRefs.current[index]?.focus();
  }

  function setBlankValue(id: number, blankIndex: number, raw: string, missingLength: number) {
    const cleaned = raw.replace(/[^a-zA-Z']/g, '').slice(0, missingLength);
    setBlankAnswers((prev) => ({ ...prev, [id]: cleaned }));
    if (!disabled && cleaned.length >= missingLength) {
      focusBlank(blankIndex + 1);
    }
  }

  function handleBlankKeyDown(e: KeyboardEvent<HTMLInputElement>, blankIndex: number, id: number) {
    const value = blankAnswers[id] ?? '';

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBlank(blankIndex + 1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBlank(blankIndex - 1);
      return;
    }
    if (e.key === 'Backspace' && value.length === 0) {
      e.preventDefault();
      focusBlank(blankIndex - 1);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium text-ink">
        Fill in the missing letters in the paragraph.
      </p>

      <div className="rounded-md border border-paper-line bg-paper px-4 py-5 sm:px-6">
        <p className="text-base leading-[2] text-ink">
          {segments.map((segment, index) => {
            if (segment.type === 'text') {
              return <span key={`t-${index}`}>{segment.text}</span>;
            }

            const value = blankAnswers[segment.id] ?? '';
            const widthCh = Math.max(segment.missingLength, 2);

            return (
              <span key={`b-${segment.id}`} className="inline">
                <span className="font-medium">{segment.visiblePrefix}</span>
                <input
                  ref={(el) => {
                    inputRefs.current[segment.blankIndex] = el;
                  }}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-label={`Missing letters ${segment.blankIndex + 1} of ${blanks.length}`}
                  disabled={disabled}
                  value={value}
                  maxLength={segment.missingLength}
                  onChange={(e) =>
                    setBlankValue(segment.id, segment.blankIndex, e.target.value, segment.missingLength)
                  }
                  onKeyDown={(e) => handleBlankKeyDown(e, segment.blankIndex, segment.id)}
                  className={`mx-0 inline-block border-0 border-b-2 bg-club-soft/40 px-0.5 py-0 text-base font-medium text-ink outline-none transition-colors disabled:opacity-70 ${
                    disabled
                      ? 'border-paper-line'
                      : 'border-dotted border-ink/50 focus:border-club focus:bg-club-soft/70'
                  }`}
                  style={{ width: `${widthCh}ch`, minWidth: `${widthCh}ch` }}
                />
              </span>
            );
          })}
        </p>

        {!disabled && (
          <p className="mt-4 border-t border-paper-line pt-3 text-xs italic text-ink-subtle">
            Click a blank to start typing. Focus moves to the next blank when filled. Use arrow keys
            to move between blanks.
          </p>
        )}
      </div>
    </div>
  );
}
