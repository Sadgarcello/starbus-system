export type WordErrorType =
  | 'EXACT'
  | 'ACCEPTED_VARIANT'
  | 'MINOR_SPELLING'
  | 'MODERATE_SPELLING'
  | 'MAJOR_RECOGNIZABLE_SPELLING'
  | 'WORD_FORM_OR_WORD_FAMILY'
  | 'WRONG_WORD'
  | 'NONSENSE'
  | 'MISSING';

export type WordGradeResult = 'correct' | 'misspelling' | 'incorrect' | 'blank';

export interface GradedWord {
  targetWord: string;
  studentAnswer: string;
  correctAnswer: string;
  wordScore: number;
  errorType: WordErrorType;
  result: WordGradeResult;
  points: number;
  maxPoints: number;
  submitted: string;
  expected: string;
  feedback: string;
}

export interface GradedPassage {
  passageScore: number;
  words: GradedWord[];
  exactWordCount: number;
  partialCreditWordCount: number;
  incorrectWordCount: number;
  /** @deprecated Use incorrectWordCount — kept for stored JSON compatibility */
  hasWrongWord: boolean;
  spellingErrorCount: number;
}

const WORD_SCORE: Record<WordErrorType, number> = {
  EXACT: 100,
  ACCEPTED_VARIANT: 100,
  MINOR_SPELLING: 90,
  MODERATE_SPELLING: 75,
  MAJOR_RECOGNIZABLE_SPELLING: 60,
  WORD_FORM_OR_WORD_FAMILY: 50,
  WRONG_WORD: 0,
  NONSENSE: 0,
  MISSING: 0,
};

const SPELLING_VARIANT_GROUPS: string[][] = [
  ['color', 'colour'],
  ['center', 'centre'],
  ['behavior', 'behaviour'],
  ['favorite', 'favourite'],
  ['organize', 'organise'],
  ['organized', 'organised'],
  ['organizing', 'organising'],
  ['analyze', 'analyse'],
  ['analyzed', 'analysed'],
  ['defense', 'defence'],
  ['license', 'licence'],
  ['theater', 'theatre'],
  ['meter', 'metre'],
  ['liter', 'litre'],
  ['honor', 'honour'],
  ['honored', 'honoured'],
  ['traveling', 'travelling'],
  ['traveled', 'travelled'],
  ['judgment', 'judgement'],
  ['catalog', 'catalogue'],
  ['program', 'programme'],
  ['gray', 'grey'],
  ['sulfur', 'sulphur'],
  ['aluminum', 'aluminium'],
  ['fiber', 'fibre'],
];

/** Irregular / morphological families — conservative, extensible list */
const WORD_FAMILY_GROUPS: string[][] = [
  ['choose', 'choice', 'chosen', 'choosing'],
  ['different', 'difference', 'differently', 'differents'],
  ['healthy', 'health', 'healthier', 'healths', 'healthily'],
  ['organize', 'organized', 'organizing', 'organisation', 'organization'],
  ['benefit', 'benefits', 'beneficial', 'benefited'],
  ['confident', 'confidence'],
  ['develop', 'development', 'developing', 'developed'],
  ['implement', 'implementation', 'implementing', 'implemented'],
  ['environment', 'environmental'],
  ['communicate', 'communication', 'communicating'],
];

const VARIANT_CANONICAL = new Map<string, string>();
for (const group of SPELLING_VARIANT_GROUPS) {
  const canonical = group[0]!;
  for (const form of group) {
    VARIANT_CANONICAL.set(form, canonical);
  }
}

const FAMILY_LOOKUP = new Map<string, number>();
for (let i = 0; i < WORD_FAMILY_GROUPS.length; i++) {
  for (const form of WORD_FAMILY_GROUPS[i]!) {
    FAMILY_LOOKUP.set(form, i);
  }
}

function normalizeLetters(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z']/g, '');
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) matrix[i]![0] = i;
  for (let j = 0; j < cols; j++) matrix[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[a.length]![b.length]!;
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i++;
  return i;
}

function characterOverlapRatio(a: string, b: string): number {
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  let intersection = 0;
  for (const ch of setA) {
    if (setB.has(ch)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export function reconstructWordAnswer(raw: string, visiblePrefix: string): string {
  const sub = normalizeLetters(raw);
  const prefix = normalizeLetters(visiblePrefix);
  if (!sub) return '';
  if (!prefix) return sub;
  if (sub.startsWith(prefix)) return sub;
  return prefix + sub;
}

function areSpellingVariants(a: string, b: string): boolean {
  if (a === b) return false;
  const ca = VARIANT_CANONICAL.get(a) ?? a;
  const cb = VARIANT_CANONICAL.get(b) ?? b;
  return ca === cb;
}

function sameWordFamily(a: string, b: string): boolean {
  const fa = FAMILY_LOOKUP.get(a);
  const fb = FAMILY_LOOKUP.get(b);
  return fa != null && fa === fb;
}

function isLikelyWordFormError(expected: string, submitted: string): boolean {
  if (sameWordFamily(expected, submitted)) return true;

  const dist = levenshtein(expected, submitted);
  if (dist <= 2) return false;

  const prefixLen = commonPrefixLength(expected, submitted);
  const minLen = Math.min(expected.length, submitted.length);
  if (prefixLen < 4 || minLen < 4) return false;
  if (prefixLen / minLen < 0.65) return false;

  const expSuffix = expected.slice(prefixLen);
  const subSuffix = submitted.slice(prefixLen);
  if (!expSuffix || !subSuffix) return false;

  const suffixDist = levenshtein(expSuffix, subSuffix);
  const suffixMax = Math.max(expSuffix.length, subSuffix.length);
  const suffixRel = suffixDist / suffixMax;

  // Shared stem with different endings — not a pure spelling slip on the target form
  if (suffixRel >= 0.25 && suffixRel <= 0.85) return true;

  return false;
}

function isNonsenseAnswer(submitted: string): boolean {
  if (!submitted) return false;
  if (!/^[a-z']+$/.test(submitted)) return true;
  if (submitted.length >= 3 && !/[aeiouy]/.test(submitted)) return true;
  return false;
}

function sameCharacterMultiset(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const tally = (s: string) => [...s].sort().join('');
  return tally(a) === tally(b);
}

function isWrongWord(expected: string, submitted: string, visiblePrefix: string): boolean {
  const dist = levenshtein(expected, submitted);
  const normalizedPrefix = normalizeLetters(visiblePrefix);
  if (dist <= 2 && sameCharacterMultiset(expected, submitted)) return false;
  if (
    dist <= 2 &&
    normalizedPrefix.length >= 2 &&
    submitted.startsWith(normalizedPrefix) &&
    expected.startsWith(normalizedPrefix)
  ) {
    const expSuffix = expected.slice(normalizedPrefix.length);
    const subSuffix = submitted.slice(normalizedPrefix.length);
    const suffixMax = Math.max(expSuffix.length, subSuffix.length, 1);
    const suffixRel = levenshtein(expSuffix, subSuffix) / suffixMax;
    if (suffixRel <= 0.5) return false;
  }
  if (
    dist <= 3 &&
    normalizedPrefix.length >= 2 &&
    submitted.startsWith(normalizedPrefix) &&
    characterOverlapRatio(expected, submitted) >= 0.75
  ) {
    return false;
  }

  const prefixLen = commonPrefixLength(expected, submitted);
  const expSuffix = expected.slice(prefixLen);
  const subSuffix = submitted.slice(prefixLen);
  const suffixMax = Math.max(expSuffix.length, subSuffix.length, 1);
  const suffixDist = levenshtein(expSuffix, subSuffix);
  const suffixRel = suffixDist / suffixMax;

  if (suffixRel > 0.55 && prefixLen >= 2) return true;

  const minLen = Math.min(expected.length, submitted.length);
  if (minLen <= 4 && dist >= 2) return true;

  if (normalizedPrefix.length >= 2 && !submitted.startsWith(normalizedPrefix)) return true;

  const relDist = dist / Math.max(expected.length, submitted.length, 1);
  const overlap = characterOverlapRatio(expected, submitted);
  if (relDist > 0.45 && overlap < 0.55) return true;

  return false;
}

function classifySpelling(
  expected: string,
  submitted: string,
  visiblePrefix: string,
): WordErrorType {
  const dist = levenshtein(submitted, expected);
  const maxLen = Math.max(expected.length, submitted.length);
  const minLen = Math.min(expected.length, submitted.length);
  const relDist = maxLen > 0 ? dist / maxLen : 1;
  const prefixLen = commonPrefixLength(submitted, expected);
  const prefixRatio = minLen > 0 ? prefixLen / minLen : 0;
  const normalizedPrefix = normalizeLetters(visiblePrefix);
  const prefixMatch =
    normalizedPrefix.length === 0 || submitted.startsWith(normalizedPrefix);

  if (!prefixMatch) return 'WRONG_WORD';
  if (isWrongWord(expected, submitted, visiblePrefix)) return 'WRONG_WORD';

  if (dist <= 2 && sameCharacterMultiset(expected, submitted)) {
    return 'MINOR_SPELLING';
  }

  if (normalizedPrefix.length >= 2 && submitted.startsWith(normalizedPrefix) && expected.startsWith(normalizedPrefix)) {
    const expSuffix = expected.slice(normalizedPrefix.length);
    const subSuffix = submitted.slice(normalizedPrefix.length);
    const suffixDist = levenshtein(subSuffix, expSuffix);
    const suffixMax = Math.max(expSuffix.length, subSuffix.length, 1);
    const suffixRel = suffixDist / suffixMax;

    if (suffixDist <= 2 && suffixRel <= 0.6) return 'MINOR_SPELLING';
    if (suffixDist <= 3 && suffixRel <= 0.5) return 'MODERATE_SPELLING';
    if (suffixDist <= 4 && suffixRel <= 0.65) return 'MAJOR_RECOGNIZABLE_SPELLING';
  }

  const overlap = characterOverlapRatio(expected, submitted);
  if (
    dist <= 3 &&
    prefixMatch &&
    overlap >= 0.75 &&
    relDist <= 0.5
  ) {
    return 'MINOR_SPELLING';
  }
  if (dist <= 2 && prefixRatio >= 0.5 && relDist <= 0.35) {
    return 'MINOR_SPELLING';
  }
  if (dist <= 3 && prefixRatio >= 0.45 && relDist <= 0.5) {
    return 'MODERATE_SPELLING';
  }
  if (dist <= 4 && prefixRatio >= 0.4 && relDist <= 0.55) {
    return 'MAJOR_RECOGNIZABLE_SPELLING';
  }

  return 'WRONG_WORD';
}

function legacyResult(errorType: WordErrorType): WordGradeResult {
  switch (errorType) {
    case 'EXACT':
    case 'ACCEPTED_VARIANT':
      return 'correct';
    case 'MINOR_SPELLING':
    case 'MODERATE_SPELLING':
    case 'MAJOR_RECOGNIZABLE_SPELLING':
      return 'misspelling';
    case 'MISSING':
      return 'blank';
    case 'WORD_FORM_OR_WORD_FAMILY':
    case 'WRONG_WORD':
    case 'NONSENSE':
      return 'incorrect';
  }
}

function toLegacyPoints(wordScore: number): number {
  return Math.round((wordScore / 100) * 100) / 100;
}

export function studentFeedbackForErrorType(errorType: WordErrorType): string {
  switch (errorType) {
    case 'EXACT':
    case 'ACCEPTED_VARIANT':
      return 'Correct.';
    case 'MINOR_SPELLING':
      return 'You identified the correct word, but there is a small spelling error.';
    case 'MODERATE_SPELLING':
      return 'You were close to the correct word, but several letters were incorrect.';
    case 'MAJOR_RECOGNIZABLE_SPELLING':
      return 'You appear to be attempting the correct word, but the spelling needs more work.';
    case 'WORD_FORM_OR_WORD_FAMILY':
      return 'You recognized the word family, but the form required by the sentence was different.';
    case 'WRONG_WORD':
      return 'Your answer is a different word from the one required by the sentence.';
    case 'NONSENSE':
      return 'This answer does not match the required word.';
    case 'MISSING':
      return 'No answer was entered.';
  }
}

export function studentLabelForErrorType(errorType: WordErrorType): string {
  switch (errorType) {
    case 'EXACT':
    case 'ACCEPTED_VARIANT':
      return 'Correct';
    case 'MINOR_SPELLING':
      return 'Minor spelling error';
    case 'MODERATE_SPELLING':
      return 'Spelling error';
    case 'MAJOR_RECOGNIZABLE_SPELLING':
      return 'Major spelling error';
    case 'WORD_FORM_OR_WORD_FAMILY':
      return 'Word form';
    case 'WRONG_WORD':
      return 'Incorrect word';
    case 'NONSENSE':
      return 'Unrecognizable';
    case 'MISSING':
      return 'Missing';
  }
}

function buildGradedWord(
  studentAnswer: string,
  correctAnswer: string,
  errorType: WordErrorType,
): GradedWord {
  const wordScore = WORD_SCORE[errorType];
  const result = legacyResult(errorType);
  const points = toLegacyPoints(wordScore);
  return {
    targetWord: correctAnswer,
    studentAnswer,
    correctAnswer,
    wordScore,
    errorType,
    result,
    points,
    maxPoints: 1,
    submitted: studentAnswer,
    expected: correctAnswer,
    feedback: studentFeedbackForErrorType(errorType),
  };
}

export function gradeSpelledWord(
  submitted: string,
  expected: string,
  visiblePrefix = '',
): GradedWord {
  const exp = normalizeLetters(expected);
  const sub = reconstructWordAnswer(submitted, visiblePrefix);
  const displaySubmitted = sub || '—';

  if (!exp) {
    return buildGradedWord(displaySubmitted, exp, 'MISSING');
  }
  if (!sub) {
    return buildGradedWord('—', exp, 'MISSING');
  }
  if (isNonsenseAnswer(sub)) {
    return buildGradedWord(sub, exp, 'NONSENSE');
  }
  if (sub === exp) {
    return buildGradedWord(sub, exp, 'EXACT');
  }
  if (areSpellingVariants(sub, exp)) {
    return buildGradedWord(sub, exp, 'ACCEPTED_VARIANT');
  }
  if (isLikelyWordFormError(exp, sub)) {
    return buildGradedWord(sub, exp, 'WORD_FORM_OR_WORD_FAMILY');
  }

  const spellingType = classifySpelling(exp, sub, visiblePrefix);
  return buildGradedWord(sub, exp, spellingType);
}

export function gradeCompleteWordsPassage(
  blanks: { id: number; expectedWord: string; visiblePrefix: string }[],
  submitted: Record<string, string>,
): GradedPassage {
  const words = blanks.map((blank) => {
    const raw = submitted[String(blank.id)] ?? '';
    return gradeSpelledWord(raw, blank.expectedWord, blank.visiblePrefix);
  });

  const passageScore =
    words.length > 0
      ? Math.round((words.reduce((sum, w) => sum + w.wordScore, 0) / words.length) * 100) / 100
      : 0;

  const exactWordCount = words.filter(
    (w) => w.errorType === 'EXACT' || w.errorType === 'ACCEPTED_VARIANT',
  ).length;
  const partialCreditWordCount = words.filter(
    (w) =>
      w.wordScore > 0 &&
      w.errorType !== 'EXACT' &&
      w.errorType !== 'ACCEPTED_VARIANT',
  ).length;
  const incorrectWordCount = words.filter((w) => w.wordScore === 0).length;

  return {
    passageScore,
    words,
    exactWordCount,
    partialCreditWordCount,
    incorrectWordCount,
    hasWrongWord: words.some(
      (w) => w.errorType === 'WRONG_WORD' || w.errorType === 'NONSENSE',
    ),
    spellingErrorCount: words.filter((w) =>
      ['MINOR_SPELLING', 'MODERATE_SPELLING', 'MAJOR_RECOGNIZABLE_SPELLING'].includes(
        w.errorType,
      ),
    ).length,
  };
}

/** @deprecated Use studentLabelForErrorType for student-facing UI */
export function resultLabel(result: WordGradeResult): string {
  switch (result) {
    case 'correct':
      return 'Correct';
    case 'misspelling':
      return 'Misspelling';
    case 'incorrect':
      return 'Incorrect';
    case 'blank':
      return 'Blank';
  }
}

/** @deprecated Use studentLabelForErrorType for student-facing UI */
export function errorTypeLabel(errorType: WordErrorType): string {
  return studentLabelForErrorType(errorType);
}
