import { useEffect, useMemo, useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import type { StudentQuestionPayload } from '@/lib/readingPractice/types';
import { buildPassageSegments, missingLetterCountFromMasked } from '@/lib/readingPractice/completeWords';

function getBlankLetters(blankAnswers: Record<number, string>, blankId: number): string[] {
  return (blankAnswers[blankId] ?? '').split('');
}

function setBlankLetter(
  setBlankAnswers: Dispatch<SetStateAction<Record<number, string>>>,
  blankId: number,
  charIndex: number,
  char: string,
  maxLength: number,
): void {
  const nextChar = char.replace(/[^a-zA-Z']/g, '').slice(-1);
  setBlankAnswers((prev) => {
    const current = (prev[blankId] ?? '').split('');
    while (current.length < maxLength) current.push('');
    current[charIndex] = nextChar;
    return { ...prev, [blankId]: current.join('').slice(0, maxLength) };
  });
}

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

  const blankSlotOffsets = useMemo(() => {
    const offsets = new Map<number, number>();
    let offset = 0;
    for (const segment of segments) {
      if (segment.type === 'blank') {
        offsets.set(segment.id, offset);
        offset += segment.missingLength;
      }
    }
    return offsets;
  }, [segments]);

  const totalLetterSlots = useMemo(
    () => blanks.reduce((sum, b) => sum + missingLetterCountFromMasked(b.maskedDisplay), 0),
    [blanks],
  );

  useEffect(() => {
    if (disabled || totalLetterSlots === 0) return;
    inputRefs.current[0]?.focus();
  }, [question.questionId, disabled, totalLetterSlots]);

  function focusSlot(slotIndex: number) {
    if (slotIndex < 0 || slotIndex >= totalLetterSlots) return;
    inputRefs.current[slotIndex]?.focus();
    inputRefs.current[slotIndex]?.select();
  }

  function handleLetterChange(
    blankId: number,
    charIndex: number,
    slotIndex: number,
    raw: string,
    maxLength: number,
  ) {
    const nextChar = raw.replace(/[^a-zA-Z']/g, '').slice(-1);
    setBlankLetter(setBlankAnswers, blankId, charIndex, raw, maxLength);
    if (!disabled && nextChar) {
      focusSlot(slotIndex + 1);
    }
  }

  function handleLetterKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    blankId: number,
    charIndex: number,
    slotIndex: number,
    maxLength: number,
  ) {
    const letters = getBlankLetters(blankAnswers, blankId);
    const current = letters[charIndex] ?? '';

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusSlot(slotIndex + 1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusSlot(slotIndex - 1);
      return;
    }
    if (e.key === 'Backspace' && !current) {
      e.preventDefault();
      if (charIndex > 0) {
        setBlankLetter(setBlankAnswers, blankId, charIndex - 1, '', maxLength);
        focusSlot(slotIndex - 1);
      } else {
        focusSlot(slotIndex - 1);
      }
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium text-ink">
        Fill in the missing letters in the paragraph.
      </p>

      <div className="rounded-md border border-paper-line bg-paper px-4 py-5 sm:px-6">
        <p className="text-base leading-[2.2] text-ink">
          {segments.map((segment, index) => {
            if (segment.type === 'text') {
              return <span key={`t-${index}`}>{segment.text}</span>;
            }

            const startSlot = blankSlotOffsets.get(segment.id) ?? 0;
            const letters = getBlankLetters(blankAnswers, segment.id);

            return (
              <span key={`b-${segment.id}`} className="inline align-baseline whitespace-nowrap">
                <span className="font-medium">{segment.visiblePrefix}</span>
                {Array.from({ length: segment.missingLength }, (_, charIndex) => {
                  const slotIndex = startSlot + charIndex;
                  const value = letters[charIndex] ?? '';

                  return (
                    <input
                      key={charIndex}
                      ref={(el) => {
                        inputRefs.current[slotIndex] = el;
                      }}
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      aria-label={`Letter ${charIndex + 1} of ${segment.missingLength} in blank ${segment.blankIndex + 1}`}
                      disabled={disabled}
                      value={value}
                      maxLength={1}
                      placeholder="-"
                      onChange={(e) =>
                        handleLetterChange(
                          segment.id,
                          charIndex,
                          slotIndex,
                          e.target.value,
                          segment.missingLength,
                        )
                      }
                      onKeyDown={(e) =>
                        handleLetterKeyDown(
                          e,
                          segment.id,
                          charIndex,
                          slotIndex,
                          segment.missingLength,
                        )
                      }
                      className={`mx-0 inline-block border-0 border-b-2 bg-transparent px-0 py-0 text-center text-base font-medium leading-none outline-none transition-colors placeholder:text-ink/40 disabled:opacity-80 ${
                        disabled
                          ? 'border-paper-line text-ink'
                          : 'border-dashed border-ink/45 text-ink focus:border-club focus:bg-club-soft/50'
                      }`}
                      style={{ width: '1.05ch', minWidth: '1.05ch', height: '1.35em' }}
                    />
                  );
                })}
              </span>
            );
          })}
        </p>

        {!disabled && (
          <p className="mt-4 border-t border-paper-line pt-3 text-xs italic text-ink-subtle">
            Each dash is one missing letter. Type in the dashes — focus moves automatically. Use
            arrow keys to move between letters.
          </p>
        )}
      </div>
    </div>
  );
}
