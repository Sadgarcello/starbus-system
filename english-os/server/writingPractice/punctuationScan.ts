import type { ErrorSeverity, WritingErrorItem } from './types.js';

/** Deterministic punctuation pass — supplements Gemini, never replaces extended-writing evaluation. */
export function scanPunctuation(text: string): WritingErrorItem[] {
  const errors: WritingErrorItem[] = [];
  const trimmed = text.trim();
  if (!trimmed) return errors;

  if (!/[.!?]$/.test(trimmed)) {
    errors.push(makeError(text, trimmed.length, trimmed.length, '.', 'PUNCTUATION', 'MODERATE', 'Missing final punctuation', '.', 'End the sentence with . ? or !'));
  }

  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    const idx = text.indexOf(s);
    if (idx >= 0 && /^[a-z]/.test(s)) {
      errors.push(
        makeError(
          text,
          idx,
          idx + 1,
          s[0]!.toUpperCase(),
          'CAPITALIZATION',
          'MINOR',
          'Sentence should start with a capital letter',
          s[0]!.toUpperCase() + s.slice(1),
          'Capitalize the first word of each sentence.',
        ),
      );
    }
  }

  if (/\s{2,}[,.]/.test(text) || /[,.]\S/.test(text.replace(/\s+/g, ' '))) {
    const m = text.match(/[,.]\S/);
    if (m && m.index != null) {
      errors.push(
        makeError(
          text,
          m.index,
          m.index + 2,
          m[0]!.replace(/(\S)/, ' $1'),
          'PUNCTUATION',
          'MINOR',
          'Add a space after punctuation where needed',
          m[0]!.slice(0, 1) + ' ' + m[0]!.slice(1),
          'Leave a space after commas and periods when starting a new word.',
        ),
      );
    }
  }

  return dedupeBySpan(errors);
}

function makeError(
  fullText: string,
  start: number,
  end: number,
  studentSlice: string,
  type: string,
  severity: ErrorSeverity,
  wrong: string,
  correction: string,
  whatToDo: string,
): WritingErrorItem {
  const student_text = fullText.slice(start, end) || studentSlice;
  return {
    student_text,
    start_offset: start,
    end_offset: end,
    error_type: type,
    severity,
    what_is_wrong: wrong,
    correction,
    why: wrong,
    what_to_do: whatToDo,
  };
}

function dedupeBySpan(items: WritingErrorItem[]): WritingErrorItem[] {
  const seen = new Set<string>();
  return items.filter((e) => {
    const key = `${e.start_offset}-${e.end_offset}-${e.error_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function punctuationScoreFromErrors(count: number, wordCount: number): number {
  if (wordCount <= 0) return 100;
  const penalty = Math.min(40, count * 8);
  return Math.max(0, 100 - penalty);
}
