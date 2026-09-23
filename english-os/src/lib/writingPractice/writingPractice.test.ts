import { describe, expect, it } from 'vitest';
import { gradeBuildSentence } from '../../../server/writingPractice/buildSentence.js';
import { MAX_WRITING_TESTS_PER_WINDOW, WRITING_WINDOW_MS } from '../../../server/writingPractice/usageLimit.js';

describe('Build a Sentence grading', () => {
  it('accepts exact target sentence', () => {
    const r = gradeBuildSentence({
      studentSentence: 'Where did you find your phone?',
      targetSentence: 'Where did you find your phone?',
    });
    expect(r.correct).toBe(true);
    expect(r.scorePercent).toBe(100);
  });

  it('flags question formation issue', () => {
    const r = gradeBuildSentence({
      studentSentence: 'Where you found your phone?',
      targetSentence: 'Where did you find your phone?',
    });
    expect(r.correct).toBe(false);
    expect(r.issueCategory).toBe('QUESTION_FORMATION');
  });

  it('accepts configured variant', () => {
    const r = gradeBuildSentence({
      studentSentence: 'Could you help me with this assignment?',
      targetSentence: 'Can you help me with this assignment?',
      acceptedVariants: ['Could you help me with this assignment?'],
    });
    expect(r.correct).toBe(true);
  });
});

describe('Writing quota constants', () => {
  it('uses 2 tests per 48h window', () => {
    expect(MAX_WRITING_TESTS_PER_WINDOW).toBe(2);
    expect(WRITING_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
  });
});
