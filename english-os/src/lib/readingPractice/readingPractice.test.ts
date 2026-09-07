import { describe, expect, it } from 'vitest';
import {
  answersMatch,
  blankAnswerMatches,
  buildCompleteWordsTask,
  checkMcqAnswer,
  gradeCompleteWordsAnswer,
  isEligibleMaskWord,
  isTrivialWord,
  maskWordSecondHalf,
  splitPassageSentences,
} from './completeWords';
import { adjustDifficulty, cefrToStartingDifficulty, clampDifficulty } from './difficulty';
import {
  buildSectionMeta,
  sectionQuotasForLength,
  sectionTypeForQuestionIndex,
} from './sectionPlan';

describe('Complete the Words', () => {
  const passage =
    'The rapid development of technology has changed communication. ' +
    'Scientists observed significant resistance to the new treatment in clinical trials.';

  it('leaves the first sentence untouched', () => {
    const task = buildCompleteWordsTask(passage);
    expect(task.displayPassage).toContain('The rapid development of technology has changed communication.');
    expect(task.displayPassage).not.toMatch(/The r a p i d/);
  });

  it('masks every second eligible word after sentence one', () => {
    const task = buildCompleteWordsTask(passage);
    expect(task.blanks.length).toBeGreaterThan(0);
    expect(task.displayPassage).toContain('_');
  });

  it('hides the second half of a word', () => {
    const { maskedWord, visiblePrefix, hiddenSuffix } = maskWordSecondHalf('development');
    expect(visiblePrefix).toBe('devel');
    expect(hiddenSuffix).toBe('opment');
    expect(maskedWord).toBe('devel______');
  });

  it('grades all blanks in a passage', () => {
    const task = buildCompleteWordsTask(passage);
    const submitted: Record<string, string> = {};
    for (const blank of task.blanks) {
      submitted[String(blank.id)] = blank.expectedWord;
    }
    const graded = gradeCompleteWordsAnswer(task.blanks, submitted);
    expect(graded.correct).toBe(true);
  });

  it('accepts suffix-only answers', () => {
    expect(blankAnswerMatches('opment', 'development', 'devel')).toBe(true);
  });

  it('accepts correct full-word answers', () => {
    expect(answersMatch('development', 'development')).toBe(true);
    expect(answersMatch('Development', 'development')).toBe(true);
  });

  it('rejects incorrect answers', () => {
    expect(answersMatch('developmen', 'development')).toBe(false);
  });

  it('flags trivial words', () => {
    expect(isTrivialWord('the')).toBe(true);
    expect(isTrivialWord('development')).toBe(false);
  });

  it('skips short words for masking', () => {
    expect(isEligibleMaskWord('the')).toBe(false);
    expect(isEligibleMaskWord('technology')).toBe(true);
  });

  it('splits multi-sentence passages', () => {
    expect(splitPassageSentences(passage).length).toBe(2);
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

describe('Sequential section plan', () => {
  it('splits 10 questions into complete words, daily life, then academic', () => {
    const quotas = sectionQuotasForLength(10);
    expect(quotas.COMPLETE_WORDS).toBe(3);
    expect(quotas.DAILY_LIFE).toBe(3);
    expect(quotas.ACADEMIC).toBe(4);
    expect(sectionTypeForQuestionIndex(0, quotas)).toBe('COMPLETE_WORDS');
    expect(sectionTypeForQuestionIndex(2, quotas)).toBe('COMPLETE_WORDS');
    expect(sectionTypeForQuestionIndex(3, quotas)).toBe('DAILY_LIFE');
    expect(sectionTypeForQuestionIndex(6, quotas)).toBe('ACADEMIC');
    expect(sectionTypeForQuestionIndex(9, quotas)).toBe('ACADEMIC');
  });

  it('builds section meta for adaptive full test', () => {
    const first = buildSectionMeta('ADAPTIVE', 10, 0);
    expect(first?.sectionType).toBe('COMPLETE_WORDS');
    expect(first?.sectionIndex).toBe(1);
    expect(first?.sectionTransition).toBe(false);

    const dailyStart = buildSectionMeta('ADAPTIVE', 10, 3);
    expect(dailyStart?.sectionType).toBe('DAILY_LIFE');
    expect(dailyStart?.sectionTransition).toBe(true);

    const academicStart = buildSectionMeta('ADAPTIVE', 10, 6);
    expect(academicStart?.sectionType).toBe('ACADEMIC');
    expect(academicStart?.sectionTransition).toBe(true);
  });
});

describe('Official CEFR separation', () => {
  it('practice difficulty adjustment is independent of CEFR label', () => {
    const start = cefrToStartingDifficulty('B2');
    const afterStrong = adjustDifficulty(start, Array(10).fill(true));
    expect(afterStrong).toBeGreaterThan(start);
    expect(afterStrong).toBeLessThan(10.1);
  });
});
