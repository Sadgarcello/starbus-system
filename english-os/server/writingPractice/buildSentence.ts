import type { BuildSentenceErrorCategory, BuildSentenceGradeResult } from './types.js';

const TOKEN_RE = /[a-z0-9']+/gi;

export function normalizeTokens(text: string): string[] {
  return (text.toLowerCase().match(TOKEN_RE) ?? []).map((t) => t.replace(/^'+|'+$/g, ''));
}

function tokensMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((t, i) => t === b[i]);
}

function classifyIssue(
  expected: string[],
  student: string[],
): { category: BuildSentenceErrorCategory | null; label: string | null; whatToDo: string | null } {
  const missing = expected.filter((w) => !student.includes(w));
  const extra = student.filter((w) => !expected.includes(w));

  const studentStr = student.join(' ');
  const expectedStr = expected.join(' ');

  if (
    expectedStr.includes(' did ') &&
    !studentStr.includes(' did ') &&
    (expected[0] === 'where' || expected[0] === 'what' || expected[0] === 'when' || expected[0] === 'why' || expected[0] === 'how')
  ) {
    return {
      category: 'QUESTION_FORMATION',
      label: 'Question formation',
      whatToDo: 'When asking about a completed past action, use DID + subject + base verb.',
    };
  }

  if (student.length < expected.length && missing.length > 0) {
    return {
      category: 'MISSING_WORD',
      label: 'Missing word(s)',
      whatToDo: `Include: ${missing.slice(0, 3).join(', ')}.`,
    };
  }
  if (student.length > expected.length && extra.length > 0) {
    return {
      category: 'EXTRA_WORD',
      label: 'Extra word(s)',
      whatToDo: `Remove or replace unnecessary words such as "${extra[0]}".`,
    };
  }

  if (expectedStr.startsWith('do ') || expectedStr.startsWith('does ') || expectedStr.startsWith('did ')) {
    if (!studentStr.match(/^(do|does|did|is|are|was|were|can|could|should|will|would|have|has|had)\b/)) {
      return {
        category: 'AUXILIARY',
        label: 'Auxiliary / question form',
        whatToDo: 'Check whether the sentence needs an auxiliary or helping verb.',
      };
    }
  }
  if (expected.some((w) => w === "n't" || w === 'not') && !student.some((w) => w === "n't" || w === 'not')) {
    return {
      category: 'NEGATION',
      label: 'Negation',
      whatToDo: 'Include the required negative form (not / n\'t).',
    };
  }

  if (student.length === expected.length) {
    return {
      category: 'WORD_ORDER',
      label: 'Word order',
      whatToDo: 'Reorder the words to match standard English sentence structure.',
    };
  }

  return { category: 'OTHER', label: 'Sentence structure', whatToDo: 'Compare your sentence to the expected pattern.' };
}

export function gradeBuildSentence(input: {
  studentSentence: string;
  targetSentence: string;
  acceptedVariants?: string[];
}): BuildSentenceGradeResult {
  const expectedTokens = normalizeTokens(input.targetSentence);
  const studentTokens = normalizeTokens(input.studentSentence);
  const variants = (input.acceptedVariants ?? []).map((v) => normalizeTokens(v));

  const matchesTarget = tokensMatch(studentTokens, expectedTokens);
  const matchesVariant = variants.some((v) => tokensMatch(studentTokens, v));
  const correct = matchesTarget || matchesVariant;

  const reference = expectedTokens;
  const missingWords = reference.filter((w) => !studentTokens.includes(w));
  const extraWords = studentTokens.filter((w) => !reference.includes(w));

  const misplacedWords: string[] = [];
  const len = Math.min(reference.length, studentTokens.length);
  for (let i = 0; i < len; i++) {
    if (reference[i] !== studentTokens[i]) misplacedWords.push(studentTokens[i]!);
  }

  let issueCategory: BuildSentenceErrorCategory | null = null;
  let issueLabel: string | null = null;
  let whatToDo: string | null = null;

  if (!correct) {
    const classified = classifyIssue(reference, studentTokens);
    issueCategory = classified.category;
    issueLabel = classified.label;
    whatToDo = classified.whatToDo;
  }

  return {
    correct,
    scorePercent: correct ? 100 : 0,
    studentSentence: input.studentSentence.trim(),
    expectedSentence: input.targetSentence.trim(),
    normalizedStudent: studentTokens,
    normalizedExpected: reference,
    missingWords,
    extraWords,
    misplacedWords,
    issueCategory,
    issueLabel,
    whatToDo,
  };
}
