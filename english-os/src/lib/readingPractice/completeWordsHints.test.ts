import { describe, expect, it } from 'vitest';
import { buildCompleteWordsHint } from './completeWordsHints';
import type { StudentQuestionPayload } from './types';

function makeQuestion(overrides: Partial<StudentQuestionPayload> = {}): StudentQuestionPayload {
  return {
    questionId: 'q1',
    questionType: 'COMPLETE_WORDS',
    skill: null,
    difficulty: 3,
    displayPassage:
      'Some peo___ like to read bo____, while oth___ prefer watc_____ videos.',
    blanks: [
      { id: 1, visiblePrefix: 'peo', maskedDisplay: 'peo___' },
      { id: 2, visiblePrefix: 'bo', maskedDisplay: 'bo____' },
    ],
    ...overrides,
  };
}

describe('buildCompleteWordsHint', () => {
  it('never includes the masked answer pattern', () => {
    const hint = buildCompleteWordsHint(makeQuestion(), {}, 1);
    expect(hint.toLowerCase()).not.toContain('people');
    expect(hint).not.toMatch(/peo[a-z]{3}/i);
  });

  it('returns general hint when no blank focused', () => {
    const hint = buildCompleteWordsHint(makeQuestion(), {}, null);
    expect(hint.length).toBeGreaterThan(20);
    expect(hint.toLowerCase()).toMatch(/sentence|meaning|letters|context|word/);
  });

  it('uses prefix context without revealing full word', () => {
    const hint = buildCompleteWordsHint(makeQuestion(), {}, 1);
    expect(hint.toLowerCase()).toMatch(/peo|letters|word|noun|verb|context/);
    expect(hint.toLowerCase()).not.toContain('people');
  });
});
