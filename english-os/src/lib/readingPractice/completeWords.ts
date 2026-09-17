import { gradeCompleteWordsPassage, type GradedWord } from './wordGrading';

const TRIVIAL_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'in', 'on', 'at', 'for',
  'and', 'or', 'but', 'with', 'from', 'as', 'by', 'be', 'it', 'its', 'this', 'that',
  'these', 'those', 'he', 'she', 'they', 'we', 'you', 'i', 'my', 'your', 'their', 'our',
]);

const MIN_MASK_WORD_LENGTH = 4;

export const DEFAULT_MASK_BLANK_COUNT = 10;

export const TARGET_PASSAGE_WORD_MIN = 70;
export const TARGET_PASSAGE_WORD_MAX = 100;

export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export function answersMatch(submitted: string, expected: string): boolean {
  return normalizeAnswer(submitted) === normalizeAnswer(expected);
}

export function isTrivialWord(word: string): boolean {
  return TRIVIAL_WORDS.has(word.toLowerCase().replace(/[^a-z]/g, ''));
}

export function checkMcqAnswer(submitted: string, correctOption: string): boolean {
  return submitted.trim().toUpperCase() === correctOption.trim().toUpperCase();
}

export interface CompleteWordsBlank {
  id: number;
  expectedWord: string;
  visiblePrefix: string;
  maskedDisplay: string;
}

export interface CompleteWordsTask {
  displayPassage: string;
  blanks: CompleteWordsBlank[];
}

export interface CompleteWordsBlankPayload {
  id: number;
  visiblePrefix: string;
  maskedDisplay: string;
}

export interface PassageSegmentText {
  type: 'text';
  text: string;
}

export interface PassageSegmentBlank {
  type: 'blank';
  id: number;
  visiblePrefix: string;
  missingLength: number;
  blankIndex: number;
}

export type PassageSegment = PassageSegmentText | PassageSegmentBlank;

export const MASK_PLACEHOLDER = '-';

export function missingLetterCountFromMasked(maskedDisplay: string): number {
  return (maskedDisplay.match(/[-_]/g) ?? []).length;
}

export function buildPassageSegments(
  passage: string,
  blanks: CompleteWordsBlankPayload[],
): PassageSegment[] {
  const segments: PassageSegment[] = [];
  let cursor = 0;

  for (let blankIndex = 0; blankIndex < blanks.length; blankIndex++) {
    const blank = blanks[blankIndex]!;
    const idx = passage.indexOf(blank.maskedDisplay, cursor);
    if (idx === -1) continue;

    if (idx > cursor) {
      segments.push({ type: 'text', text: passage.slice(cursor, idx) });
    }

    segments.push({
      type: 'blank',
      id: blank.id,
      visiblePrefix: blank.visiblePrefix,
      missingLength: missingLetterCountFromMasked(blank.maskedDisplay),
      blankIndex,
    });

    cursor = idx + blank.maskedDisplay.length;
  }

  if (cursor < passage.length) {
    segments.push({ type: 'text', text: passage.slice(cursor) });
  }

  return segments;
}

export function splitPassageSentences(passage: string): string[] {
  const trimmed = passage.trim();
  if (!trimmed) return [];
  const parts = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return (parts ?? [trimmed]).map((s) => s.trim()).filter(Boolean);
}

export function countPassageWords(passage: string): number {
  return passage.trim().match(/\b[A-Za-z']+\b/g)?.length ?? 0;
}

export function isEligibleMaskWord(word: string): boolean {
  const letters = word.replace(/[^a-zA-Z]/g, '');
  if (letters.length < MIN_MASK_WORD_LENGTH) return false;
  if (isTrivialWord(word)) return false;
  return true;
}

export function maskWordSecondHalf(word: string): {
  maskedWord: string;
  visiblePrefix: string;
  hiddenSuffix: string;
} {
  const letters = word.match(/[a-zA-Z]/g) ?? [];
  if (letters.length <= 1) {
    const normalized = word.replace(/[A-Z]/g, (c) => c.toLowerCase());
    return { maskedWord: normalized, visiblePrefix: normalized, hiddenSuffix: '' };
  }

  const keepCount = Math.floor(letters.length / 2);
  let letterIndex = 0;
  let visiblePrefix = '';
  let hiddenSuffix = '';
  const maskedChars: string[] = [];

  for (const ch of word) {
    if (!/[a-zA-Z]/.test(ch)) {
      maskedChars.push(ch);
      continue;
    }
    const letter = ch.toLowerCase();
    letterIndex++;
    if (letterIndex <= keepCount) {
      maskedChars.push(letter);
      visiblePrefix += letter;
    } else {
      maskedChars.push(MASK_PLACEHOLDER);
      hiddenSuffix += letter;
    }
  }

  return {
    maskedWord: maskedChars.join(''),
    visiblePrefix,
    hiddenSuffix,
  };
}

export function countEligibleBlanks(passage: string, maxBlanks: number = DEFAULT_MASK_BLANK_COUNT): number {
  return buildCompleteWordsTask(passage, maxBlanks).blanks.length;
}

export function validatePassageBlankCount(
  passage: string,
  requiredBlanks: number = DEFAULT_MASK_BLANK_COUNT,
): { valid: boolean; blankCount: number; message?: string } {
  const blankCount = countEligibleBlanks(passage, requiredBlanks);
  if (blankCount === requiredBlanks) {
    return { valid: true, blankCount };
  }
  if (blankCount < requiredBlanks) {
    return {
      valid: false,
      blankCount,
      message: `This passage produces ${blankCount} blanks but ${requiredBlanks} are required. Add more eligible content words after the first sentence.`,
    };
  }
  return {
    valid: false,
    blankCount,
    message: `Unexpected blank count (${blankCount}). Contact support if this persists.`,
  };
}

export function buildCompleteWordsTask(
  passage: string,
  maxBlanks: number = DEFAULT_MASK_BLANK_COUNT,
): CompleteWordsTask {
  const sentences = splitPassageSentences(passage);
  const blanks: CompleteWordsBlank[] = [];
  const displaySentences: string[] = [];
  let blankId = 0;

  sentences.forEach((sentence, sentenceIndex) => {
    let wordIndex = 0;
    const wordPattern = /\b([A-Za-z']+)\b/g;

    const display = sentence.replace(wordPattern, (word) => {
      wordIndex++;

      if (sentenceIndex === 0) return word;
      if (blanks.length >= maxBlanks) return word;
      if (wordIndex % 2 !== 0) return word;
      if (!isEligibleMaskWord(word)) return word;

      const { maskedWord, visiblePrefix } = maskWordSecondHalf(word);
      blanks.push({
        id: blankId,
        expectedWord: word,
        visiblePrefix,
        maskedDisplay: maskedWord,
      });
      blankId++;
      return maskedWord;
    });

    displaySentences.push(display);
  });

  return {
    displayPassage: displaySentences.join(' '),
    blanks,
  };
}

export function toStudentBlanks(blanks: CompleteWordsBlank[]): CompleteWordsBlankPayload[] {
  return blanks.map(({ id, visiblePrefix, maskedDisplay }) => ({
    id,
    visiblePrefix,
    maskedDisplay,
  }));
}

export interface CompleteWordsSubmissionMeta {
  passageScore: number;
  sessionDifficultyBefore?: number;
  sessionDifficultyAfter?: number;
  questionDifficulty?: number;
  hasWrongWord?: boolean;
}

export function parseCompleteWordsSubmission(answer: string): Record<string, string> {
  const trimmed = answer.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.blanks && typeof parsed.blanks === 'object') {
        return parsed.blanks as Record<string, string>;
      }
      const { blanks: _b, passageScore: _p, sessionDifficultyBefore: _s, sessionDifficultyAfter: _a, questionDifficulty: _q, hasWrongWord: _w, words: _words, ...rest } = parsed;
      return rest as Record<string, string>;
    } catch {
      return {};
    }
  }
  return { '0': trimmed };
}

export function parseCompleteWordsSubmissionMeta(answer: string): CompleteWordsSubmissionMeta | null {
  const trimmed = answer.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.passageScore !== 'number') return null;
    return {
      passageScore: parsed.passageScore,
      sessionDifficultyBefore:
        typeof parsed.sessionDifficultyBefore === 'number' ? parsed.sessionDifficultyBefore : undefined,
      sessionDifficultyAfter:
        typeof parsed.sessionDifficultyAfter === 'number' ? parsed.sessionDifficultyAfter : undefined,
      questionDifficulty:
        typeof parsed.questionDifficulty === 'number' ? parsed.questionDifficulty : undefined,
      hasWrongWord: parsed.hasWrongWord === true,
    };
  } catch {
    return null;
  }
}

export function blankAnswerMatches(
  submitted: string,
  expectedWord: string,
  visiblePrefix: string,
): boolean {
  if (answersMatch(submitted, expectedWord)) return true;
  const suffix = expectedWord.slice(visiblePrefix.length);
  if (suffix && answersMatch(submitted, suffix)) return true;
  if (visiblePrefix && answersMatch(visiblePrefix + submitted, expectedWord)) return true;
  return false;
}

export function gradeCompleteWordsAnswer(
  blanks: CompleteWordsBlank[],
  submitted: Record<string, string>,
): {
  correct: boolean;
  passageScore: number;
  hasWrongWord: boolean;
  exactWordCount: number;
  partialCreditWordCount: number;
  incorrectWordCount: number;
  words: GradedWord[];
  results: { id: number; correct: boolean; expectedWord: string }[];
} {
  const graded = gradeCompleteWordsPassage(blanks, submitted);
  const results = blanks.map((blank, index) => {
    const word = graded.words[index]!;
    return {
      id: blank.id,
      correct: word.wordScore === 100,
      expectedWord: blank.expectedWord,
    };
  });
  return {
    correct: graded.passageScore >= 85,
    passageScore: graded.passageScore,
    hasWrongWord: graded.hasWrongWord,
    exactWordCount: graded.exactWordCount,
    partialCreditWordCount: graded.partialCreditWordCount,
    incorrectWordCount: graded.incorrectWordCount,
    words: graded.words,
    results,
  };
}
