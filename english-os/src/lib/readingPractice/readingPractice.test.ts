import { describe, expect, it } from 'vitest';
import {
  answersMatch,
  checkMcqAnswer,
  isTrivialWord,
  maskTargetWord,
  missingLetterCount,
  validateTargetWordInSentence,
} from './completeWords';
import { adjustDifficulty, cefrToStartingDifficulty, clampDifficulty } from './difficulty';

describe('Complete the Words', () => {
  const sentence = 'The rapid development of technology has changed communication.';
  const target = 'development';

  it('masks word without exposing full target', () => {
    const masked = maskTargetWord(sentence, target, 6);
    expect(masked).toContain('_');
    expect(masked.toLowerCase()).not.toContain('development');
  });

  it('accepts correct answer', () => {
    expect(answersMatch('development', target)).toBe(true);
  });

  it('ignores capitalization', () => {
    expect(answersMatch('Development', target)).toBe(true);
  });

  it('trims whitespace', () => {
    expect(answersMatch('  development  ', target)).toBe(true);
  });

  it('rejects incorrect answer', () => {
    expect(answersMatch('developmen', target)).toBe(false);
  });

  it('validates target in sentence', () => {
    expect(validateTargetWordInSentence(sentence, target)).toBe(true);
    expect(validateTargetWordInSentence(sentence, 'missing')).toBe(false);
  });

  it('flags trivial words', () => {
    expect(isTrivialWord('the')).toBe(true);
    expect(isTrivialWord('development')).toBe(false);
  });

  it('scales missing letters with difficulty', () => {
    expect(missingLetterCount(2, 11)).toBeLessThan(missingLetterCount(9, 11));
  });
});

describe('Adaptive difficulty', () => {
  it('maps CEFR to starting difficulty', () => {
    expect(cefrToStartingDifficulty('B2')).toBe(6);
    expect(cefrToStartingDifficulty('A1')).toBe(2);
  });

  it('increases after 9/10 correct', () => {
    const next = adjustDifficulty(6, [
      true, true, true, true, true, true, true, true, true, false,
    ]);
    expect(next).toBeGreaterThan(6);
  });

  it('decreases after 5/10 correct', () => {
    const recent = [true, false, false, true, false, true, false, false, true, false];
    const next = adjustDifficulty(6, recent);
    expect(next).toBeLessThan(6);
  });

  it('holds steady around 7/10', () => {
    const recent = [true, true, true, true, true, true, true, false, false, false];
    const next = adjustDifficulty(6, recent);
    expect(next).toBe(6);
  });

  it('single mistake does not crash difficulty', () => {
    const next = adjustDifficulty(6, [false]);
    expect(next).toBeGreaterThanOrEqual(1);
    expect(next).toBeLessThanOrEqual(10);
  });

  it('clamps between 1 and 10', () => {
    expect(clampDifficulty(0)).toBe(1);
    expect(clampDifficulty(15)).toBe(10);
  });
});

describe('Daily Life MCQ', () => {
  it('checks correct option', () => {
    expect(checkMcqAnswer('b', 'B')).toBe(true);
    expect(checkMcqAnswer('A', 'B')).toBe(false);
  });
});

describe('Official CEFR separation', () => {
  it('practice difficulty adjustment is independent of CEFR label', () => {
    const start = cefrToStartingDifficulty('B2');
    const afterStrong = adjustDifficulty(start, Array(10).fill(true));
    expect(afterStrong).toBeGreaterThan(start);
    // Does not imply C1 — just practice diff
    expect(afterStrong).toBeLessThan(10.1);
  });
});
