import { useEffect, useMemo, useRef, type Dispatch, type FormEvent, type KeyboardEvent, type SetStateAction } from 'react';
import { examLetterInputClassName, examLetterInputProps } from '@/lib/examInputAssist';
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
  const nextChar = char.replace(/[^a-zA-Z']/g, '').slice(-1).toLowerCase();
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
  onBlankFocus,
}: {
  question: StudentQuestionPayload;
  blankAnswers: Record<number, string>;
  setBlankAnswers: Dispatch<SetStateAction<Record<number, string>>>;
  disabled: boolean;
  onBlankFocus?: (blankId: number) => void;
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

  function handleLetterBeforeInput(
    e: FormEvent<HTMLInputElement>,
    blankId: number,
    charIndex: number,
    slotIndex: number,
    maxLength: number,
  ) {
    const data = (e.nativeEvent as InputEvent).data;
    if (!data) return;
    const letter = data.replace(/[^a-zA-Z']/g, '').slice(-1);
    if (!letter) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    handleLetterChange(blankId, charIndex, slotIndex, letter.toLowerCase(), maxLength);
  }

  function handleLetterChange(
    blankId: number,
    charIndex: number,
    slotIndex: number,
    raw: string,
    maxLength: number,
  ) {
    const nextChar = raw.replace(/[^a-zA-Z']/g, '').slice(-1).toLowerCase();
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

    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      focusSlot(slotIndex + 1);
      return;
    }
    if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      focusSlot(slotIndex - 1);
      return;
    }
    if (e.key.length === 1 && /[a-zA-Z']/.test(e.key)) {
      e.preventDefault();
      handleLetterChange(blankId, charIndex, slotIndex, e.key, maxLength);
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (current) {
        setBlankLetter(setBlankAnswers, blankId, charIndex, '', maxLength);
        return;
      }
      if (charIndex > 0) {
        setBlankLetter(setBlankAnswers, blankId, charIndex - 1, '', maxLength);
        focusSlot(slotIndex - 1);
      } else {
        focusSlot(slotIndex - 1);
      }
      return;
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-paper-line bg-paper px-4 py-5 sm:px-5" lang="en">
        <p className="text-base leading-[2.2] text-ink">
          {segments.map((segment, index) => {
            if (segment.type === 'text') {
              return <span key={`t-${index}`}>{segment.text}</span>;
            }

            const startSlot = blankSlotOffsets.get(segment.id) ?? 0;
            const letters = getBlankLetters(blankAnswers, segment.id);

            return (
              <span key={`b-${segment.id}`} className="inline align-baseline whitespace-nowrap normal-case">
                <span className="font-medium lowercase">{segment.visiblePrefix}</span>
                {Array.from({ length: segment.missingLength }, (_, charIndex) => {
                  const slotIndex = startSlot + charIndex;
                  const value = (letters[charIndex] ?? '').toLowerCase();

                  return (
                    <input
                      key={charIndex}
                      ref={(el) => {
                        inputRefs.current[slotIndex] = el;
                      }}
                      type="text"
                      {...examLetterInputProps}
                      inputMode={'verbatim' as 'text'}
                      name={`blank-${segment.id}-${charIndex}`}
                      aria-label={`Letter ${charIndex + 1} of ${segment.missingLength} in blank ${segment.blankIndex + 1}`}
                      disabled={disabled}
                      value={value}
                      maxLength={1}
                      placeholder="-"
                      onBeforeInput={(e) =>
                        handleLetterBeforeInput(
                          e,
                          segment.id,
                          charIndex,
                          slotIndex,
                          segment.missingLength,
                        )
                      }
                      onChange={(e) =>
                        handleLetterChange(
                          segment.id,
                          charIndex,
                          slotIndex,
                          e.target.value,
                          segment.missingLength,
                        )
                      }
                      onFocus={() => onBlankFocus?.(segment.id)}
                      onKeyDown={(e) =>
                        handleLetterKeyDown(
                          e,
                          segment.id,
                          charIndex,
                          slotIndex,
                          segment.missingLength,
                        )
                      }
                      className={`${examLetterInputClassName} mx-0 inline-block border-0 border-b-2 bg-transparent px-0 py-0 text-center text-base font-medium leading-none outline-none transition-colors placeholder:text-ink/40 disabled:opacity-80 ${
                        disabled
                          ? 'border-paper-line text-ink'
                          : 'border-dashed border-ink/45 text-ink focus:border-club focus:bg-club-soft/50'
                      }`}
                      style={{ width: '1.05ch', minWidth: '1.05ch', height: '1.35em', textTransform: 'lowercase' }}
                    />
                  );
                })}
              </span>
            );
          })}
        </p>

      </div>

      {!disabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-paper-line bg-paper-soft/50 px-3 py-2.5 text-xs text-ink-subtle">
          <p className="flex items-center gap-2">
            <span aria-hidden className="text-base leading-none">
              ⌨
            </span>
            <span>
              Each dash is one missing letter. Type in the blanks — your cursor moves automatically.
            </span>
          </p>
          <p className="shrink-0 font-medium text-ink-muted">
            <kbd className="rounded border border-paper-line bg-paper px-1.5 py-0.5 text-[10px]">
              Tab
            </kbd>
            {' · '}
            <kbd className="rounded border border-paper-line bg-paper px-1.5 py-0.5 text-[10px]">
              ←
            </kbd>
            {' '}
            <kbd className="rounded border border-paper-line bg-paper px-1.5 py-0.5 text-[10px]">
              →
            </kbd>
          </p>
        </div>
      )}
    </div>
  );
}
