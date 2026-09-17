import type { ReadingPracticeMode, ReadingQuestionType } from './types';

/** Single-mode sessions must only serve this question type (null = mixed / adaptive). */
export function expectedQuestionTypeForMode(mode: ReadingPracticeMode): ReadingQuestionType | null {
  if (mode === 'COMPLETE_WORDS') return 'COMPLETE_WORDS';
  if (mode === 'DAILY_LIFE') return 'DAILY_LIFE';
  if (mode === 'ACADEMIC') return 'ACADEMIC';
  return null;
}

/** Legacy ADAPTIVE chained sessions are deprecated — new practice uses one mode per session. */
export function normalizePracticeMode(raw: string | null | undefined): ReadingPracticeMode {
  if (!raw || raw === 'ADAPTIVE') return 'COMPLETE_WORDS';
  if (raw === 'COMPLETE_WORDS' || raw === 'DAILY_LIFE' || raw === 'ACADEMIC') return raw;
  return 'COMPLETE_WORDS';
}

export const PRACTICE_MODE_LABEL: Record<ReadingPracticeMode, string> = {
  ADAPTIVE: 'Full reading practice (legacy)',
  COMPLETE_WORDS: 'Complete the Words',
  DAILY_LIFE: 'Read in Daily Life',
  ACADEMIC: 'Read an Academic Passage',
};

export const PRACTICE_MODE_SHORT: Record<Exclude<ReadingPracticeMode, 'ADAPTIVE'>, string> = {
  COMPLETE_WORDS: 'Complete the Words',
  DAILY_LIFE: 'Read in Daily Life',
  ACADEMIC: 'Read an Academic Passage',
};
