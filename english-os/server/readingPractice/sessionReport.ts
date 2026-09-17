import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildCompleteWordsTask,
  parseCompleteWordsSubmission,
  parseCompleteWordsSubmissionMeta,
} from './completeWords.js';
import type {
  MissedWordReport,
  ReadingPracticeMode,
  ReadingQuestionType,
  ResultChecklistItem,
  SessionHistoryEntry,
  SessionResultsSummary,
  WordGradeResult,
  WordResultDetail,
} from './types.js';
import { estimateProficiency, PLACEMENT_SESSION_LENGTH } from './difficultyPools.js';
import { gradeSpelledWord } from './wordGrading.js';
import { SECTION_LABELS } from './sectionPlan.js';
import { summarizeSkills } from './selection.js';
import type { ReadingSkill } from './types.js';

interface AttemptRow {
  question_id: string;
  question_type: ReadingQuestionType;
  skill: ReadingSkill | null;
  correct: boolean;
  answer: string | null;
  difficulty: number | null;
  cefr_level: string | null;
  attempted_at: string;
  missed_words: MissedWordReport[] | null;
}

function tally(list: { question_type: string; correct: boolean }[], type: ReadingQuestionType) {
  const subset = list.filter((a) => a.question_type === type);
  const total = subset.length;
  const correct = subset.filter((a) => a.correct).length;
  return { total, correct, accuracy: total ? Math.round((correct / total) * 100) : 0 };
}

function missedFromChecklist(items: ResultChecklistItem[]): MissedWordReport[] {
  return items
    .filter((i) => i.questionType === 'COMPLETE_WORDS' && i.result !== 'correct')
    .map((i) => ({
      word: i.correctAnswer,
      submitted: i.yourAnswer === '—' ? null : i.yourAnswer,
      result: i.result as WordGradeResult,
      itemNumber: i.number,
    }));
}

export async function buildSessionResultsReport(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
  session: Record<string, unknown>,
  studentLevel: string,
  endingDifficulty: number,
): Promise<SessionResultsSummary> {
  const { data: attempts } = await admin
    .from('reading_attempts')
    .select(
      'question_id, question_type, skill, correct, answer, difficulty, cefr_level, attempted_at, missed_words',
    )
    .eq('session_id', sessionId)
    .order('attempted_at', { ascending: true });

  const list = (attempts ?? []) as AttemptRow[];
  const mode = session.mode as ReadingPracticeMode;
  const isPlacement = mode === 'COMPLETE_WORDS';

  if (isPlacement) {
    return buildPlacementReport(admin, studentId, sessionId, session, studentLevel, list, endingDifficulty);
  }

  const checklist: ResultChecklistItem[] = [];
  let itemNumber = 0;
  let passageIndex = 0;

  for (const attempt of list) {
    if (attempt.question_type === 'COMPLETE_WORDS') {
      passageIndex++;
      const { data: q } = await admin
        .from('complete_words_questions')
        .select('sentence, difficulty')
        .eq('id', attempt.question_id)
        .single();
      if (!q) continue;

      const task = buildCompleteWordsTask(q.sentence as string);
      const submitted = parseCompleteWordsSubmission(attempt.answer ?? '');

      for (const blank of task.blanks) {
        itemNumber++;
        const raw = submitted[String(blank.id)] ?? '';
        const graded = gradeSpelledWord(raw, blank.expectedWord, blank.visiblePrefix);
        checklist.push({
          number: itemNumber,
          questionType: 'COMPLETE_WORDS',
          sectionLabel: SECTION_LABELS.COMPLETE_WORDS,
          yourAnswer: graded.submitted,
          correctAnswer: graded.expected,
          result: graded.result,
          points: graded.points,
          maxPoints: graded.maxPoints,
          difficulty: Number(q.difficulty),
          passageIndex,
        });
      }
      continue;
    }

    itemNumber++;
    let yourAnswer = attempt.answer ?? '—';
    let correctAnswer = '—';

    if (attempt.question_type === 'DAILY_LIFE') {
      const { data: q } = await admin
        .from('daily_life_questions')
        .select('question, option_a, option_b, option_c, option_d, correct_option, difficulty')
        .eq('id', attempt.question_id)
        .single();
      if (q) {
        const key = (attempt.answer ?? '').trim().toUpperCase();
        const optKey = `option_${key.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d';
        yourAnswer = key ? `${key}. ${(q[optKey] as string) ?? key}` : '—';
        const correctKey = String(q.correct_option).toUpperCase();
        const correctOpt =
          q[`option_${correctKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
        correctAnswer = `${correctKey}. ${correctOpt}`;
        checklist.push({
          number: itemNumber,
          questionType: 'DAILY_LIFE',
          sectionLabel: SECTION_LABELS.DAILY_LIFE,
          yourAnswer,
          correctAnswer,
          result: attempt.correct ? 'correct' : 'incorrect',
          points: attempt.correct ? 1 : 0,
          maxPoints: 1,
          difficulty: Number(q.difficulty),
        });
        continue;
      }
    }

    if (attempt.question_type === 'ACADEMIC') {
      const { data: q } = await admin
        .from('academic_questions')
        .select('question, option_a, option_b, option_c, option_d, correct_option, difficulty')
        .eq('id', attempt.question_id)
        .single();
      if (q) {
        const key = (attempt.answer ?? '').trim().toUpperCase();
        const optKey = `option_${key.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d';
        yourAnswer = key ? `${key}. ${(q[optKey] as string) ?? key}` : '—';
        const correctKey = String(q.correct_option).toUpperCase();
        const correctOpt =
          q[`option_${correctKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
        correctAnswer = `${correctKey}. ${correctOpt}`;
        checklist.push({
          number: itemNumber,
          questionType: 'ACADEMIC',
          sectionLabel: SECTION_LABELS.ACADEMIC,
          yourAnswer,
          correctAnswer,
          result: attempt.correct ? 'correct' : 'incorrect',
          points: attempt.correct ? 1 : 0,
          maxPoints: 1,
          difficulty: Number(q.difficulty),
        });
        continue;
      }
    }

    checklist.push({
      number: itemNumber,
      questionType: attempt.question_type,
      sectionLabel: SECTION_LABELS[attempt.question_type],
      yourAnswer,
      correctAnswer,
      result: attempt.correct ? 'correct' : 'incorrect',
      points: attempt.correct ? 1 : 0,
      maxPoints: 1,
      difficulty: attempt.difficulty != null ? Number(attempt.difficulty) : undefined,
    });
  }

  const totalPoints = checklist.reduce((s, i) => s + i.points, 0);
  const maxPoints = checklist.reduce((s, i) => s + i.maxPoints, 0);
  const fullMarks = checklist.filter((i) => i.result === 'correct').length;
  const accuracyPercent = maxPoints ? Math.round((totalPoints / maxPoints) * 100) : 0;
  const missedWords = missedFromChecklist(checklist);

  const { strongest, weakest } = summarizeSkills(
    list.map((a) => ({ skill: a.skill, correct: a.correct })),
  );

  const byType = {
    COMPLETE_WORDS: tally(list, 'COMPLETE_WORDS'),
    DAILY_LIFE: tally(list, 'DAILY_LIFE'),
    ACADEMIC: tally(list, 'ACADEMIC'),
  };

  const completedAt = (session.completed_at as string) ?? new Date().toISOString();

  const summary: SessionResultsSummary = {
    sessionId,
    completedAt,
    mode,
    studentLevel,
    practiceDifficulty: endingDifficulty,
    startingDifficulty: Number(session.starting_difficulty),
    endingDifficulty,
    questions: list.length,
    correct: list.filter((a) => a.correct).length,
    accuracy: list.length ? Math.round((list.filter((a) => a.correct).length / list.length) * 100) : 0,
    totalPoints,
    maxPoints,
    accuracyPercent,
    fullMarks,
    itemCount: checklist.length,
    checklist,
    missedWords,
    history: [],
    strongestSkill: strongest,
    weakestSkill: weakest,
    byType,
  };

  summary.history = await loadSessionHistory(admin, studentId);

  return summary;
}

function aggregateMissedWordsFromAttempts(attempts: AttemptRow[]): MissedWordReport[] {
  const out: MissedWordReport[] = [];
  let wordIndex = 0;
  for (const attempt of attempts) {
    for (const entry of attempt.missed_words ?? []) {
      wordIndex++;
      out.push({
        word: entry.word,
        submitted: entry.submitted,
        itemNumber: wordIndex,
      });
    }
  }
  return out;
}

function wordDetailsFromAttempt(
  attempt: AttemptRow,
  task: ReturnType<typeof buildCompleteWordsTask> | null,
): WordResultDetail[] {
  const answerRaw = attempt.answer ?? '';
  if (answerRaw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(answerRaw) as { words?: WordResultDetail[] };
      if (Array.isArray(parsed.words) && parsed.words.length > 0) {
        return parsed.words;
      }
    } catch {
      /* fall through */
    }
  }

  if (!task) return [];
  const submitted = parseCompleteWordsSubmission(answerRaw);
  return task.blanks.map((blank) => {
    const raw = submitted[String(blank.id)] ?? '';
    const graded = gradeSpelledWord(raw, blank.expectedWord, blank.visiblePrefix);
    return {
      targetWord: graded.targetWord,
      studentAnswer: graded.studentAnswer,
      correctAnswer: graded.correctAnswer,
      wordScore: graded.wordScore,
      errorType: graded.errorType,
      feedback: graded.feedback,
    };
  });
}

function passageScoreFromAttempt(attempt: AttemptRow, words: WordResultDetail[]): number {
  if (words.length > 0) {
    return Math.round((words.reduce((s, w) => s + w.wordScore, 0) / words.length) * 100) / 100;
  }
  const meta = parseCompleteWordsSubmissionMeta(attempt.answer ?? '');
  if (meta) {
    const score = meta.passageScore;
    return score <= 10 ? score * 10 : score;
  }
  return attempt.correct ? 100 : 0;
}

async function buildPlacementReport(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
  session: Record<string, unknown>,
  studentLevel: string,
  list: AttemptRow[],
  endingDifficulty: number,
): Promise<SessionResultsSummary> {
  const checklist: ResultChecklistItem[] = [];
  const placementAttempts: {
    passageScore: number;
    difficulty: number;
  }[] = [];

  let passageIndex = 0;
  for (const attempt of list) {
    passageIndex++;
    const { data: q } = await admin
      .from('complete_words_questions')
      .select('sentence, difficulty')
      .eq('id', attempt.question_id)
      .single();

    const task = q ? buildCompleteWordsTask(q.sentence as string) : null;
    const words = wordDetailsFromAttempt(attempt, task);
    const passageScore = passageScoreFromAttempt(attempt, words);
    const meta = parseCompleteWordsSubmissionMeta(attempt.answer ?? '');
    const questionDifficulty = Number(attempt.difficulty ?? q?.difficulty ?? 1);

    placementAttempts.push({
      passageScore,
      difficulty: questionDifficulty,
    });

    checklist.push({
      number: passageIndex,
      questionType: 'COMPLETE_WORDS',
      sectionLabel: SECTION_LABELS.COMPLETE_WORDS,
      yourAnswer: `${Math.round(passageScore)}%`,
      correctAnswer: 'Passage average',
      result: passageScore >= 85 ? 'correct' : 'incorrect',
      points: passageScore,
      maxPoints: 100,
      difficulty: questionDifficulty,
      passageIndex,
      passageScore,
      words,
      sessionDifficultyBefore: meta?.sessionDifficultyBefore,
      sessionDifficultyAfter: meta?.sessionDifficultyAfter,
      classification:
        passageScore >= 85 ? 'Strong' : passageScore >= 50 ? 'Developing' : 'Needs support',
    });
  }

  const totalPassages = list.length;
  const overallScoreOutOf100 =
    totalPassages > 0
      ? Math.round(
          (placementAttempts.reduce((s, a) => s + a.passageScore, 0) / totalPassages) * 10,
        ) / 10
      : 0;
  const passagesAtMastery = placementAttempts.filter((a) => a.passageScore >= 85).length;
  const estimate = estimateProficiency(placementAttempts);
  const missedWords = aggregateMissedWordsFromAttempts(list);
  const completedAt = (session.completed_at as string) ?? new Date().toISOString();
  const accuracyPercent = Math.round(overallScoreOutOf100);

  const summary: SessionResultsSummary = {
    sessionId,
    completedAt,
    mode: 'COMPLETE_WORDS',
    studentLevel,
    practiceDifficulty: endingDifficulty,
    startingDifficulty: Number(session.starting_difficulty),
    endingDifficulty,
    questions: totalPassages,
    correct: passagesAtMastery,
    accuracy: accuracyPercent,
    totalPoints: overallScoreOutOf100,
    maxPoints: 100,
    accuracyPercent,
    fullMarks: passagesAtMastery,
    itemCount: PLACEMENT_SESSION_LENGTH,
    checklist,
    missedWords,
    history: [],
    strongestSkill: null,
    weakestSkill: null,
    byType: {
      COMPLETE_WORDS: {
        total: totalPassages,
        correct: passagesAtMastery,
        accuracy: accuracyPercent,
      },
      DAILY_LIFE: { total: 0, correct: 0, accuracy: 0 },
      ACADEMIC: { total: 0, correct: 0, accuracy: 0 },
    },
    placement: {
      estimatedLevel: estimate.estimatedLevel,
      difficultyReached: estimate.difficultyReached,
      weightedPerformance: Math.round(estimate.weightedPerformance * 100),
      passageScore: `${overallScoreOutOf100}/100`,
      overallScoreOutOf10: Math.round((overallScoreOutOf100 / 10) * 10) / 10,
      overallScoreOutOf100,
    },
  };

  summary.history = await loadSessionHistory(admin, studentId);
  return summary;
}

export interface SessionHistoryOptions {
  mode?: ReadingPracticeMode;
  limit?: number;
}

async function loadSessionHistory(
  admin: SupabaseClient,
  studentId: string,
  options?: SessionHistoryOptions,
): Promise<SessionHistoryEntry[]> {
  let query = admin
    .from('reading_practice_sessions')
    .select('id, mode, completed_at, starting_difficulty, ending_difficulty, results_report')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(options?.limit ?? 12);

  if (options?.mode) {
    query = query.eq('mode', options.mode);
  }

  const { data: sessions } = await query;

  const { data: student } = await admin.from('students').select('level').eq('id', studentId).single();
  const level = (student?.level as string) ?? '—';

  return (sessions ?? []).map((s) => {
    const report = s.results_report as SessionResultsSummary | null;
    return {
      sessionId: s.id as string,
      completedAt: (s.completed_at as string) ?? '',
      mode: s.mode as ReadingPracticeMode,
      studentLevel: level,
      practiceDifficulty: Number(s.ending_difficulty ?? s.starting_difficulty),
      totalPoints: report?.totalPoints ?? 0,
      maxPoints: report?.maxPoints ?? 0,
      accuracyPercent: report?.accuracyPercent ?? 0,
      fullMarks: report?.fullMarks ?? 0,
      itemCount: report?.itemCount ?? 0,
    };
  });
}

export async function getStoredSessionReport(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
): Promise<SessionResultsSummary | null> {
  const { data: session } = await admin
    .from('reading_practice_sessions')
    .select('results_report, student_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.student_id !== studentId || session.status !== 'completed') {
    return null;
  }

  const report = session.results_report as SessionResultsSummary | null;
  if (!report) return null;

  return { ...report, history: await loadSessionHistory(admin, studentId) };
}

export async function listSessionHistory(
  admin: SupabaseClient,
  studentId: string,
  options?: SessionHistoryOptions,
): Promise<SessionHistoryEntry[]> {
  return loadSessionHistory(admin, studentId, { limit: 20, ...options });
}
