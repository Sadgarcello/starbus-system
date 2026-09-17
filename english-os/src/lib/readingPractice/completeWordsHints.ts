import { missingLetterCountFromMasked } from './completeWords';
import type { StudentQuestionPayload } from './types';

export interface BlankHintContext {
  blankId: number;
  visiblePrefix: string;
  missingLength: number;
  sentenceSnippet: string;
}

/** Extract a short sentence fragment around a blank for contextual hints (no answer keys). */
export function getBlankHintContext(
  question: StudentQuestionPayload,
  blankId: number,
): BlankHintContext | null {
  const passage = question.displayPassage ?? question.displaySentence ?? '';
  const blanks = question.blanks ?? [];
  const blank = blanks.find((b) => b.id === blankId);
  if (!blank || !passage) return null;

  const masked = blank.maskedDisplay;
  const idx = passage.indexOf(masked);
  if (idx === -1) {
    return {
      blankId,
      visiblePrefix: blank.visiblePrefix,
      missingLength: missingLetterCountFromMasked(blank.maskedDisplay),
      sentenceSnippet: passage.slice(0, 120).trim(),
    };
  }

  const before = passage.slice(Math.max(0, idx - 60), idx);
  const after = passage.slice(idx + masked.length, idx + masked.length + 60);
  const snippet = `${before}[…]${after}`.replace(/\s+/g, ' ').trim();

  return {
    blankId,
    visiblePrefix: blank.visiblePrefix,
    missingLength: missingLetterCountFromMasked(blank.maskedDisplay),
    sentenceSnippet: snippet,
  };
}

export function findFirstIncompleteBlankId(
  question: StudentQuestionPayload,
  blankAnswers: Record<number, string>,
): number | null {
  for (const blank of question.blanks ?? []) {
    const needed = missingLetterCountFromMasked(blank.maskedDisplay);
    const typed = (blankAnswers[blank.id] ?? '').length;
    if (typed < needed) return blank.id;
  }
  const first = question.blanks?.[0];
  return first?.id ?? null;
}

/** General + contextual hints — never reveals the full word or missing letters. */
export function buildCompleteWordsHint(
  question: StudentQuestionPayload,
  blankAnswers: Record<number, string>,
  focusedBlankId: number | null,
): string {
  const targetId =
    focusedBlankId ?? findFirstIncompleteBlankId(question, blankAnswers);
  const ctx = targetId != null ? getBlankHintContext(question, targetId) : null;

  if (!ctx) {
    return 'Read the whole paragraph first. Each blank is part of a word — use the letters you already see and the meaning of the sentence to decide what fits.';
  }

  const parts: string[] = [];

  if (ctx.visiblePrefix.length >= 2) {
    parts.push(
      `You already have the letters “${ctx.visiblePrefix}” at the start of one word. Think about what English word those letters could belong to in this sentence.`,
    );
  } else {
    parts.push(
      'Look at the letters you already have and think about the meaning of the sentence around the blank.',
    );
  }

  if (ctx.missingLength > 0) {
    parts.push(`That word still needs ${ctx.missingLength} more letter${ctx.missingLength === 1 ? '' : 's'}.`);
  }

  if (ctx.sentenceSnippet) {
    parts.push(`Context: “…${ctx.sentenceSnippet}…” — what type of word (noun, verb, adjective) would fit naturally here?`);
  }

  return parts.join(' ');
}
