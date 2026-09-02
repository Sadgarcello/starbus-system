const TRIVIAL_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'in', 'on', 'at', 'for',
  'and', 'or', 'but', 'with', 'from', 'as', 'by', 'be', 'it', 'its', 'this', 'that',
  'these', 'those', 'he', 'she', 'they', 'we', 'you', 'i', 'my', 'your', 'their', 'our',
]);

export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export function answersMatch(submitted: string, expected: string): boolean {
  return normalizeAnswer(submitted) === normalizeAnswer(expected);
}

export function validateTargetWordInSentence(sentence: string, targetWord: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(targetWord)}\\b`, 'i');
  return pattern.test(sentence);
}

export function isTrivialWord(word: string): boolean {
  return TRIVIAL_WORDS.has(word.toLowerCase());
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** How many letters to hide based on difficulty 1–10 */
export function missingLetterCount(difficulty: number, wordLength: number): number {
  const len = Math.max(1, wordLength);
  if (difficulty <= 3) return Math.min(1, len - 1);
  if (difficulty <= 5) return Math.min(2, Math.max(1, Math.floor(len * 0.25)));
  if (difficulty <= 7) return Math.min(3, Math.max(2, Math.floor(len * 0.35)));
  return Math.min(Math.max(3, Math.floor(len * 0.45)), len - 1);
}

/**
 * Mask target word in sentence. Returns display sentence with spaced letters and _ for hidden.
 * Original target word is not exposed in return value beyond masked form.
 */
export function maskTargetWord(sentence: string, targetWord: string, difficulty: number): string {
  const pattern = new RegExp(`(\\b)(${escapeRegex(targetWord)})(\\b)`, 'i');
  const match = sentence.match(pattern);
  if (!match || match.index === undefined) {
    throw new Error('target_word_not_in_sentence');
  }

  const actualWord = match[2];
  const hideCount = missingLetterCount(difficulty, actualWord.replace(/[^a-zA-Z]/g, '').length);
  const indicesToHide = pickHiddenIndices(actualWord, hideCount);

  const masked = actualWord
    .split('')
    .map((ch, i) => {
      if (!/[a-zA-Z]/.test(ch)) return ch;
      const alphaIndex = actualWord.slice(0, i).replace(/[^a-zA-Z]/g, '').length;
      if (indicesToHide.has(alphaIndex)) return '_';
      return ch;
    })
    .join(' ')
    .replace(/ ([',.-]) /g, '$1');

  return (
    sentence.slice(0, match.index) +
    match[1] +
    masked +
    match[3] +
    sentence.slice(match.index + match[0].length)
  );
}

function pickHiddenIndices(word: string, count: number): Set<number> {
  const letters = [...word].filter((c) => /[a-zA-Z]/.test(c));
  const len = letters.length;
  if (len <= 1 || count <= 0) return new Set();

  const hide = Math.min(count, len - 1);
  const indices = new Set<number>();

  // Prefer middle/consonants — deterministic spread
  const candidates = Array.from({ length: len }, (_, i) => i).filter((i) => i !== 0);
  const step = Math.max(1, Math.floor(len / hide));
  for (let i = 0; indices.size < hide && i < len * 2; i += step) {
    indices.add(candidates[i % candidates.length] ?? 1);
  }
  return indices;
}

export function checkMcqAnswer(submitted: string, correctOption: string): boolean {
  return submitted.trim().toUpperCase() === correctOption.trim().toUpperCase();
}
