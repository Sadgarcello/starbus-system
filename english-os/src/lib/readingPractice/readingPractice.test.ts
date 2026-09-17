import { describe, expect, it } from 'vitest';
import {
  answersMatch,
  blankAnswerMatches,
  buildCompleteWordsTask,
  buildPassageSegments,
  checkMcqAnswer,
  DEFAULT_MASK_BLANK_COUNT,
  gradeCompleteWordsAnswer,
  isEligibleMaskWord,
  isTrivialWord,
  maskWordSecondHalf,
  splitPassageSentences,
  toStudentBlanks,
} from './completeWords';
import { adjustDifficulty, cefrToStartingDifficulty, clampDifficulty } from './difficulty';
import { gradeCompleteWordsPassage, gradeSpelledWord } from './wordGrading';
import {
  adjustSessionDifficulty,
  adjustSessionDifficultyFromPassageScore,
  clampSessionDifficulty,
  estimateProficiency,
  PLACEMENT_SESSION_LENGTH,
  PLACEMENT_START_DIFFICULTY,
  poolForDifficulty,
  selectCompleteWordsByPool,
} from './difficultyPools';
import type { QuestionCandidate } from './types';
import {
  buildSectionMeta,
  effectiveSessionLength,
  MIN_COMPLETE_WORDS_QUESTIONS,
  sectionQuotasForLength,
  sectionTypeForQuestionIndex,
} from './sectionPlan';
import { selectQuestion } from './selection';
import type { ReadingPracticeProfile } from './types';

describe('Complete the Words', () => {
  const passage =
    'The rapid development of technology has changed communication. ' +
    'Scientists observed significant resistance to the new treatment in clinical trials.';

  const etsPassage =
    'The implementation of the new environmental policy required careful planning and cooperation from local communities. ' +
    'Government officials first examined the potential effects of the policy before introducing it to the public. ' +
    'They also consulted environmental experts and local organizations to identify possible problems. ' +
    'Although some residents were initially concerned about the changes, most eventually supported the policy after learning about its long-term benefits.';

  it('leaves the first sentence untouched', () => {
    const task = buildCompleteWordsTask(passage);
    expect(task.displayPassage).toContain('The rapid development of technology has changed communication.');
    expect(task.displayPassage).not.toMatch(/The r a p i d/);
    expect(task.displayPassage).not.toMatch(/o f f i/);
  });

  it('masks without spaces between letters', () => {
    const { maskedWord } = maskWordSecondHalf('officials');
    expect(maskedWord).toBe('offi-----');
    expect(maskedWord).not.toContain(' ');
  });

  it('uses one dash per missing letter', () => {
    const { maskedWord, visiblePrefix, hiddenSuffix } = maskWordSecondHalf('water');
    expect(visiblePrefix).toBe('wa');
    expect(hiddenSuffix).toBe('ter');
    expect(maskedWord).toBe('wa---');
  });

  it('caps at 10 masked words total', () => {
    const task = buildCompleteWordsTask(etsPassage);
    expect(task.blanks.length).toBeLessThanOrEqual(DEFAULT_MASK_BLANK_COUNT);
  });

  it('leaves later sentences intact after 10 blanks', () => {
    const longPassage =
      etsPassage +
      ' Additional sentence one with many content words here today. ' +
      'Additional sentence two with many content words here today again.';
    const task = buildCompleteWordsTask(longPassage);
    expect(task.blanks.length).toBe(DEFAULT_MASK_BLANK_COUNT);
    expect(task.displayPassage).toContain(
      'Although some residents were initially concerned about the changes',
    );
  });

  it('masks every second eligible word after sentence one until cap', () => {
    const task = buildCompleteWordsTask(passage);
    expect(task.blanks.length).toBeGreaterThan(0);
    expect(task.displayPassage).toContain('-');
    expect(task.displayPassage).not.toMatch(/[a-z] [a-z] -/);
  });

  it('hides the second half of a word', () => {
    const { maskedWord, visiblePrefix, hiddenSuffix } = maskWordSecondHalf('development');
    expect(visiblePrefix).toBe('devel');
    expect(hiddenSuffix).toBe('opment');
    expect(maskedWord).toBe('devel------');
  });

  it('lowercases masked words from capitalized passage text', () => {
    const passage =
      'First sentence stays as written. ' +
      'The Officials examined the Implementation carefully in the region.';
    const task = buildCompleteWordsTask(passage);
    expect(task.blanks.length).toBeGreaterThan(0);
    for (const blank of task.blanks) {
      expect(blank.visiblePrefix).toBe(blank.visiblePrefix.toLowerCase());
      expect(blank.maskedDisplay).toBe(blank.maskedDisplay.toLowerCase());
    }
    expect(task.displayPassage).toContain('offi');
    expect(task.displayPassage).not.toMatch(/Offi/);
  });

  it('builds inline passage segments for blanks', () => {
    const task = buildCompleteWordsTask(etsPassage);
    const segments = buildPassageSegments(task.displayPassage, toStudentBlanks(task.blanks));
    const blankSegments = segments.filter((s) => s.type === 'blank');
    expect(blankSegments.length).toBe(task.blanks.length);
    expect(segments.some((s) => s.type === 'text')).toBe(true);
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

describe('Complete the Words placement pools', () => {
  it('starts every student at difficulty 1', () => {
    expect(PLACEMENT_START_DIFFICULTY).toBe(1);
    expect(PLACEMENT_SESSION_LENGTH).toBe(10);
    expect(poolForDifficulty(PLACEMENT_START_DIFFICULTY).pool).toBe(1);
  });

  it('uses integer adaptive steps from passage percent scores', () => {
    expect(adjustSessionDifficultyFromPassageScore(1, 100)).toBe(2);
    expect(adjustSessionDifficultyFromPassageScore(5, 90)).toBe(6);
    expect(adjustSessionDifficultyFromPassageScore(5, 70)).toBe(5);
    expect(adjustSessionDifficultyFromPassageScore(5, 40)).toBe(4);
    expect(adjustSessionDifficultyFromPassageScore(1, 20)).toBe(1);
    expect(adjustSessionDifficultyFromPassageScore(10, 100)).toBe(10);
  });

  it('climbs 1→10 across ten strong passages', () => {
    let diff = 1;
    for (let i = 0; i < 10; i++) {
      diff = adjustSessionDifficultyFromPassageScore(diff, 100);
    }
    expect(diff).toBe(10);
  });

  it('keeps legacy binary helper for backwards compatibility', () => {
    expect(adjustSessionDifficulty(2, true)).toBeGreaterThan(2);
    expect(adjustSessionDifficulty(5, false)).toBeLessThan(5);
  });

  it('selects from the matching difficulty pool', () => {
    const candidates: QuestionCandidate[] = [
      { questionId: 'a', questionType: 'COMPLETE_WORDS', skill: 'VOCABULARY', difficulty: 2, cefrLevel: 'A2' },
      { questionId: 'b', questionType: 'COMPLETE_WORDS', skill: 'VOCABULARY', difficulty: 8, cefrLevel: 'C1' },
    ];
    const pick = selectCompleteWordsByPool(candidates, 1, [], []);
    expect(pick?.questionId).toBe('a');
  });

  it('prefers exact difficulty match within a pool', () => {
    const candidates: QuestionCandidate[] = [
      { questionId: 'near', questionType: 'COMPLETE_WORDS', skill: 'VOCABULARY', difficulty: 6, cefrLevel: 'B2' },
      { questionId: 'exact', questionType: 'COMPLETE_WORDS', skill: 'VOCABULARY', difficulty: 7, cefrLevel: 'B2' },
      { questionId: 'far', questionType: 'COMPLETE_WORDS', skill: 'VOCABULARY', difficulty: 8, cefrLevel: 'C1' },
    ];
    const pick = selectCompleteWordsByPool(candidates, 7, [], []);
    expect(pick?.questionId).toBe('exact');
  });

  it('picks randomly among eligible same-pool questions instead of DB order', () => {
    const candidates: QuestionCandidate[] = Array.from({ length: 10 }, (_, i) => ({
      questionId: `q${i}`,
      questionType: 'COMPLETE_WORDS' as const,
      skill: 'VOCABULARY' as const,
      difficulty: 2,
      cefrLevel: 'A2',
    }));
    const picks = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const pick = selectCompleteWordsByPool(candidates, 2, [], []);
      if (pick) picks.add(pick.questionId);
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it('estimates lower level when student fails hard questions', () => {
    const easy = estimateProficiency(
      Array.from({ length: 6 }, () => ({ passageScore: 70, difficulty: 2 })).concat([
        { passageScore: 40, difficulty: 8 },
        { passageScore: 30, difficulty: 9 },
        { passageScore: 50, difficulty: 7 },
        { passageScore: 60, difficulty: 6 },
      ]),
    );
    const strong = estimateProficiency(
      Array.from({ length: 7 }, (_, i) => ({
        passageScore: 92,
        difficulty: 4 + i,
      })).concat([{ passageScore: 60, difficulty: 9 }]),
    );
    expect(['A1', 'A2', 'B1']).toContain(easy.estimatedLevel);
    expect(['B2', 'C1']).toContain(strong.estimatedLevel);
  });

  it('uses highest served difficulty, not average of correct attempts', () => {
    const estimate = estimateProficiency([
      { passageScore: 100, difficulty: 2 },
      { passageScore: 100, difficulty: 4 },
      { passageScore: 80, difficulty: 2 },
    ]);
    expect(estimate.difficultyReached).toBe(4);
  });

  it('clamps session difficulty to integers 1–10', () => {
    expect(clampSessionDifficulty(0)).toBe(1);
    expect(clampSessionDifficulty(15)).toBe(10);
    expect(clampSessionDifficulty(4.7)).toBe(5);
  });
});

describe('Word grading — diagnostic scale', () => {
  it('gives 100 for exact answers', () => {
    const graded = gradeSpelledWord('before', 'before');
    expect(graded.wordScore).toBe(100);
    expect(graded.errorType).toBe('EXACT');
  });

  it('accepts British/American spelling variants', () => {
    expect(gradeSpelledWord('organised', 'organized').wordScore).toBe(100);
    expect(gradeSpelledWord('colour', 'color').errorType).toBe('ACCEPTED_VARIANT');
  });

  it('reconstructs suffix-only submissions with visible prefix', () => {
    expect(gradeSpelledWord('opment', 'development', 'devel').wordScore).toBe(100);
  });

  it('gives zero for blank answers', () => {
    expect(gradeSpelledWord('', 'before').wordScore).toBe(0);
    expect(gradeSpelledWord('', 'before').errorType).toBe('MISSING');
  });

  it('grades minor spelling errors at 90', () => {
    expect(gradeSpelledWord('protuct', 'protect', 'pro').wordScore).toBe(90);
    expect(gradeSpelledWord('tierd', 'tired', 'ti').wordScore).toBe(90);
    expect(gradeSpelledWord('schedual', 'schedule', 'sche').wordScore).toBe(90);
    expect(gradeSpelledWord('sinlig', 'single', 'si').wordScore).toBe(90);
  });

  it('grades word-form errors at 50', () => {
    expect(gradeSpelledWord('choice', 'choose', 'cho').wordScore).toBe(50);
    expect(gradeSpelledWord('differents', 'difference', 'diff').wordScore).toBe(50);
    expect(gradeSpelledWord('healths', 'healthy', 'heal').wordScore).toBe(50);
  });

  it('gives zero for wrong-word answers', () => {
    expect(gradeSpelledWord('most', 'more', 'mo').wordScore).toBe(0);
    expect(gradeSpelledWord('packstore', 'packaging', 'pack').wordScore).toBe(0);
    expect(gradeSpelledWord('insight', 'instead', 'in').wordScore).toBe(0);
    expect(gradeSpelledWord('recording', 'recommend', 'rec').wordScore).toBe(0);
    expect(gradeSpelledWord('becomes', 'because', 'be').wordScore).toBe(0);
    expect(gradeSpelledWord('awful', 'awake', 'awa').wordScore).toBe(0);
    expect(gradeSpelledWord('tower', 'topic', 'to').wordScore).toBe(0);
    expect(gradeSpelledWord('clear', 'clubs', 'cl').wordScore).toBe(0);
    expect(gradeSpelledWord('harm', 'have', 'ha').wordScore).toBe(0);
  });

  it('does not give spelling credit to plausible but wrong words', () => {
    expect(gradeSpelledWord('usful', 'using', 'us').wordScore).toBe(0);
    expect(gradeSpelledWord('speacial', 'speaking', 'spe').wordScore).toBe(0);
    expect(gradeSpelledWord('explore', 'explain', 'ex').wordScore).toBe(0);
  });
});

describe('Ahmed regression grading samples', () => {
  const exactPairs = [
    ['language', 'language'],
    ['help', 'help'],
    ['become', 'become'],
    ['confident', 'confident'],
    ['minutes', 'minutes'],
    ['practice', 'practice'],
    ['useful', 'useful'],
    ['vocabulary', 'vocabulary'],
    ['books', 'books'],
    ['videos', 'videos'],
    ['other', 'other'],
    ['every', 'every'],
    ['makes', 'makes'],
    ['easier', 'easier'],
  ] as const;

  it.each(exactPairs)('%s → %s = 100', (submitted, expected) => {
    expect(gradeSpelledWord(submitted, expected).wordScore).toBe(100);
  });
});

describe('Passage scoring', () => {
  it('averages ten word scores into passage percent', () => {
    const cases = [
      ['protect', 'protect', 'pro'],
      ['choose', 'choose', 'ch'],
      ['choose', 'choose', 'ch'],
      ['choose', 'choose', 'ch'],
      ['choose', 'choose', 'ch'],
      ['protect', 'protuct', 'pro'],
      ['tired', 'tierd', 'ti'],
      ['choose', 'choice', 'ch'],
      ['more', 'most', 'mo'],
      ['help', '', 'he'],
    ] as const;
    const blanks = cases.map(([expected], id) => ({
      id,
      expectedWord: expected,
      visiblePrefix: cases[id]![2],
    }));
    const submitted = Object.fromEntries(cases.map(([, answer], id) => [String(id), answer]));
    const graded = gradeCompleteWordsPassage(blanks, submitted);
    const expectedAverage =
      cases.reduce((sum, [expected, answer, prefix]) => {
        return sum + gradeSpelledWord(answer, expected, prefix).wordScore;
      }, 0) / cases.length;
    expect(graded.passageScore).toBe(expectedAverage);
  });

  it('returns 100% for ten exact words', () => {
    const blanks = Array.from({ length: 10 }, (_, id) => ({
      id,
      expectedWord: 'protect',
      visiblePrefix: 'pro',
    }));
    const submitted = Object.fromEntries(blanks.map((b) => [String(b.id), 'protect']));
    const graded = gradeCompleteWordsPassage(blanks, submitted);
    expect(graded.passageScore).toBe(100);
  });
});

describe('Daily Life MCQ', () => {
  it('checks correct option', () => {
    expect(checkMcqAnswer('b', 'B')).toBe(true);
    expect(checkMcqAnswer('A', 'B')).toBe(false);
  });
});

describe('Sequential section plan', () => {
  it('uses at least 10 complete-the-words questions in adaptive mode', () => {
    const quotas = sectionQuotasForLength(10, 'ADAPTIVE');
    expect(quotas.COMPLETE_WORDS).toBe(MIN_COMPLETE_WORDS_QUESTIONS);
    expect(quotas.DAILY_LIFE).toBeGreaterThanOrEqual(1);
    expect(quotas.ACADEMIC).toBeGreaterThanOrEqual(1);
    expect(effectiveSessionLength(10, 'ADAPTIVE')).toBe(12);
    expect(sectionTypeForQuestionIndex(0, quotas)).toBe('COMPLETE_WORDS');
    expect(sectionTypeForQuestionIndex(9, quotas)).toBe('COMPLETE_WORDS');
    expect(sectionTypeForQuestionIndex(10, quotas)).toBe('DAILY_LIFE');
    expect(sectionTypeForQuestionIndex(11, quotas)).toBe('ACADEMIC');
  });

  it('requires minimum 10 passages in complete-words-only mode', () => {
    const quotas = sectionQuotasForLength(5, 'COMPLETE_WORDS');
    expect(quotas.COMPLETE_WORDS).toBe(10);
  });

  it('builds section meta for adaptive full test', () => {
    const first = buildSectionMeta('ADAPTIVE', 10, 0);
    expect(first?.sectionType).toBe('COMPLETE_WORDS');
    expect(first?.sectionIndex).toBe(1);
    expect(first?.sectionTransition).toBe(false);
    expect(first?.questionsInSection).toBe(10);
    expect(first?.totalQuestions).toBe(12);

    const dailyStart = buildSectionMeta('ADAPTIVE', 10, 10);
    expect(dailyStart?.sectionType).toBe('DAILY_LIFE');
    expect(dailyStart?.sectionTransition).toBe(true);

    const academicStart = buildSectionMeta('ADAPTIVE', 10, 11);
    expect(academicStart?.sectionType).toBe('ACADEMIC');
    expect(academicStart?.sectionTransition).toBe(true);
  });
});

describe('Daily Life session selection', () => {
  const profile = {
    overall_reading_difficulty: 4,
    complete_words_difficulty: 4,
    daily_life_difficulty: 4,
    academic_difficulty: 4,
  } as ReadingPracticeProfile;

  it('never serves Complete the Words during a Daily Life-only session', () => {
    const candidates = [
      { questionId: 'cw1', questionType: 'COMPLETE_WORDS' as const, skill: 'VOCABULARY' as const, difficulty: 4, cefrLevel: 'B1' },
      { questionId: 'dl1', questionType: 'DAILY_LIFE' as const, skill: 'DETAIL' as const, difficulty: 4, cefrLevel: 'B1' },
    ];
    const pick = selectQuestion({
      mode: 'DAILY_LIFE',
      profile,
      recentQuestionIds: ['dl1'],
      sessionQuestionIds: [],
      candidates,
    });
    expect(pick?.questionType).toBe('DAILY_LIFE');
    expect(pick?.questionId).toBe('dl1');
  });

  it('serves the next question in order when a Daily Life context is active', () => {
    const candidates = [
      {
        questionId: 'dl1',
        questionType: 'DAILY_LIFE' as const,
        skill: 'DETAIL' as const,
        difficulty: 4,
        cefrLevel: 'B1',
        contextId: 'ctx1',
        questionOrder: 0,
      },
      {
        questionId: 'dl2',
        questionType: 'DAILY_LIFE' as const,
        skill: 'DETAIL' as const,
        difficulty: 4,
        cefrLevel: 'B1',
        contextId: 'ctx1',
        questionOrder: 1,
      },
    ];
    const first = selectQuestion({
      mode: 'DAILY_LIFE',
      profile,
      recentQuestionIds: [],
      sessionQuestionIds: [],
      candidates,
      activeContextId: 'ctx1',
    });
    expect(first?.questionId).toBe('dl1');

    const second = selectQuestion({
      mode: 'DAILY_LIFE',
      profile,
      recentQuestionIds: [],
      sessionQuestionIds: ['dl1'],
      candidates,
      activeContextId: 'ctx1',
    });
    expect(second?.questionId).toBe('dl2');
  });

  it('returns null instead of Complete the Words when no Daily Life questions remain', () => {
    const candidates = [
      { questionId: 'cw1', questionType: 'COMPLETE_WORDS' as const, skill: 'VOCABULARY' as const, difficulty: 4, cefrLevel: 'B1' },
      { questionId: 'cw2', questionType: 'COMPLETE_WORDS' as const, skill: 'VOCABULARY' as const, difficulty: 5, cefrLevel: 'B1' },
    ];
    const pick = selectQuestion({
      mode: 'DAILY_LIFE',
      profile,
      recentQuestionIds: [],
      sessionQuestionIds: [],
      candidates,
    });
    expect(pick).toBeNull();
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
