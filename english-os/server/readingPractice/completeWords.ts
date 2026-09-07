const TRIVIAL_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'in', 'on', 'at', 'for',
  'and', 'or', 'but', 'with', 'from', 'as', 'by', 'be', 'it', 'its', 'this', 'that',
  'these', 'those', 'he', 'she', 'they', 'we', 'you', 'i', 'my', 'your', 'their', 'our',
]);

const MIN_MASK_WORD_LENGTH = 4;

/** TOEFL Complete the Words: exactly this many blanks per passage (ETS sample). */
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

/** Hide the second half of a word's letters; non-letters stay visible. No spacing between letters. */
export function maskWordSecondHalf(word: string): {
  maskedWord: string;
  visiblePrefix: string;
  hiddenSuffix: string;
} {
  const letters = word.match(/[a-zA-Z]/g) ?? [];
  if (letters.length <= 1) {
    return { maskedWord: word, visiblePrefix: word, hiddenSuffix: '' };
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
    letterIndex++;
    if (letterIndex <= keepCount) {
      maskedChars.push(ch);
      visiblePrefix += ch;
    } else {
      maskedChars.push('_');
      hiddenSuffix += ch;
    }
  }

  return {
    maskedWord: maskedChars.join(''),
    visiblePrefix,
    hiddenSuffix,
  };
}

/**
 * ETS-style Complete the Words:
 * - First sentence fully intact
 * - In later sentences, every second word may be masked (if eligible)
 * - Stop after 10 masked words; remaining sentences stay intact
 * - Masked form: offi_____ (no spaces between letters)
 */
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

export function parseCompleteWordsSubmission(answer: string): Record<string, string> {
  const trimmed = answer.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return { '0': trimmed };
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
): { correct: boolean; results: { id: number; correct: boolean; expectedWord: string }[] } {
  const results = blanks.map((blank) => {
    const raw = submitted[String(blank.id)] ?? '';
    const ok = blankAnswerMatches(raw, blank.expectedWord, blank.visiblePrefix);
    return { id: blank.id, correct: ok, expectedWord: blank.expectedWord };
  });
  return {
    correct: results.length > 0 && results.every((r) => r.correct),
    results,
  };
}
