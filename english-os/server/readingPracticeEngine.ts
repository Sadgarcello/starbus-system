import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildCompleteWordsTask,
  DEFAULT_MASK_BLANK_COUNT,
  gradeCompleteWordsAnswer,
  parseCompleteWordsSubmission,
  toStudentBlanks,
  checkMcqAnswer,
} from './readingPractice/completeWords.js';
import {
  adjustDifficulty,
  cefrToStartingDifficulty,
  updateMastery,
  updateSkillScore,
} from './readingPractice/difficulty.js';
import {
  PLACEMENT_START_DIFFICULTY,
  poolForDifficulty,
  selectCompleteWordsByPool,
  adjustSessionDifficultyFromPassageScore,
} from './readingPractice/difficultyPools.js';
import type { GradedWord } from './readingPractice/wordGrading.js';
import { selectQuestion } from './readingPractice/selection.js';
import { buildSectionMeta, effectiveSessionLength } from './readingPractice/sectionPlan.js';
import type {
  MissedWordReport,
  QuestionCandidate,
  ReadingPracticeMode,
  ReadingPracticeProfile,
  ReadingQuestionType,
  ReadingSkill,
  SessionResultsSummary,
  StudentQuestionPayload,
} from './readingPractice/types.js';
import { buildSessionResultsReport } from './readingPractice/sessionReport.js';
import { DEFAULT_SESSION_LENGTH, HISTORY_EXCLUDE_COUNT, RECENT_WINDOW } from './readingPractice/types.js';

export async function ensureReadingProfile(
  admin: SupabaseClient,
  studentId: string,
  officialCefr: string,
): Promise<ReadingPracticeProfile> {
  const { data: existing } = await admin
    .from('reading_practice_profiles')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (existing) return existing as ReadingPracticeProfile;

  const start = cefrToStartingDifficulty(officialCefr);
  const row = {
    student_id: studentId,
    overall_reading_difficulty: start,
    complete_words_difficulty: start,
    daily_life_difficulty: start,
    academic_difficulty: start,
  };
  const { data, error } = await admin.from('reading_practice_profiles').insert(row).select('*').single();
  if (error) throw error;
  return data as ReadingPracticeProfile;
}

type StudentAuthRow = {
  id: string;
  level: string;
  exam_track: string | null;
  user_id: string;
};

async function loadStudentAuthRow(
  admin: SupabaseClient,
  userId: string,
): Promise<StudentAuthRow | null> {
  const { data, error } = await admin
    .from('students')
    .select('id, level, exam_track, user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as StudentAuthRow | null) ?? null;
}

/** Ensures an active student profile has a students row (backfill for legacy/manual accounts). */
async function ensureStudentRow(admin: SupabaseClient, userId: string): Promise<StudentAuthRow | null> {
  const existing = await loadStudentAuthRow(admin, userId);
  if (existing) return existing;

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;

  if (!profile || profile.role !== 'student') {
    throw new Error('students_only');
  }
  if (profile.status !== 'active') {
    throw new Error('account_not_active');
  }

  const { error: insertError } = await admin.from('students').insert({ user_id: userId, level: 'A1' });
  if (insertError && !insertError.message.toLowerCase().includes('duplicate')) {
    throw insertError;
  }

  return loadStudentAuthRow(admin, userId);
}

export async function assertToeflStudent(
  admin: SupabaseClient,
  userId: string,
): Promise<{ studentId: string; level: string; examTrack: string | null }> {
  const student = await ensureStudentRow(admin, userId);

  if (!student) throw new Error('not_a_student');
  if (student.exam_track !== 'toefl') throw new Error('toefl_only');
  return {
    studentId: student.id as string,
    level: student.level || 'A1',
    examTrack: student.exam_track,
  };
}

async function loadStaffProfile(admin: SupabaseClient, userId: string) {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role, status, is_locked')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return profile;
}

function isStaffRole(role: string | null | undefined): boolean {
  return role === 'teacher' || role === 'admin';
}

/** Students may only read their own results; teachers/admins may read any student. */
export async function resolveReadingResultsAccess(
  admin: SupabaseClient,
  userId: string,
  requestedStudentId?: string,
): Promise<{ studentId: string; isStaff: boolean }> {
  const profile = await loadStaffProfile(admin, userId);

  if (profile && profile.status === 'active' && !profile.is_locked && isStaffRole(profile.role)) {
    if (!requestedStudentId) throw new Error('student_id_required');
    const { data: student, error } = await admin
      .from('students')
      .select('id')
      .eq('id', requestedStudentId)
      .maybeSingle();
    if (error) throw error;
    if (!student) throw new Error('student_not_found');
    return { studentId: student.id as string, isStaff: true };
  }

  const student = await ensureStudentRow(admin, userId);
  if (!student) throw new Error('not_a_student');
  if (student.exam_track !== 'toefl') throw new Error('toefl_only');
  if (requestedStudentId && requestedStudentId !== student.id) {
    throw new Error('forbidden');
  }
  return { studentId: student.id as string, isStaff: false };
}

async function loadRecentQuestionIds(
  admin: SupabaseClient,
  studentId: string,
): Promise<string[]> {
  const { data } = await admin
    .from('reading_question_history')
    .select('question_id')
    .eq('student_id', studentId)
    .order('shown_at', { ascending: false })
    .limit(HISTORY_EXCLUDE_COUNT);
  return (data ?? []).map((r) => r.question_id as string);
}

async function loadCompleteWordsCandidates(admin: SupabaseClient): Promise<QuestionCandidate[]> {
  const { data: cw, error: cwErr } = await admin
    .from('complete_words_questions')
    .select('id, cefr_level, difficulty, category')
    .eq('active', true);
  if (cwErr) throw new Error(cwErr.message);
  return (cw ?? []).map((q) => ({
    questionId: q.id as string,
    questionType: 'COMPLETE_WORDS' as const,
    skill: 'VOCABULARY' as const,
    difficulty: Number(q.difficulty),
    cefrLevel: q.cefr_level as string,
  }));
}

async function loadDailyLifeCandidates(admin: SupabaseClient): Promise<QuestionCandidate[]> {
  const [{ data: dl, error: dlErr }, { data: contexts, error: ctxErr }] = await Promise.all([
    admin
      .from('daily_life_questions')
      .select('id, context_id, cefr_level, difficulty, skill, created_at')
      .eq('active', true)
      .order('created_at', { ascending: true }),
    admin.from('daily_life_contexts').select('id, cefr_level'),
  ]);
  if (dlErr) throw new Error(dlErr.message);
  if (ctxErr) throw new Error(ctxErr.message);

  const cefrByContext = new Map((contexts ?? []).map((c) => [c.id as string, c.cefr_level as string]));
  const orderInContext = new Map<string, number>();

  return (dl ?? []).map((q) => {
    const contextId = q.context_id as string | null;
    let questionOrder = 0;
    if (contextId) {
      questionOrder = orderInContext.get(contextId) ?? 0;
      orderInContext.set(contextId, questionOrder + 1);
    }
    return {
      questionId: q.id as string,
      questionType: 'DAILY_LIFE' as const,
      skill: q.skill as ReadingSkill,
      difficulty: Number(q.difficulty),
      cefrLevel: contextId ? (cefrByContext.get(contextId) ?? (q.cefr_level as string)) : (q.cefr_level as string),
      contextId: contextId ?? undefined,
      questionOrder,
    };
  });
}

async function loadAcademicCandidates(admin: SupabaseClient): Promise<QuestionCandidate[]> {
  const [{ data: aq, error: aqErr }, { data: passages, error: pErr }] = await Promise.all([
    admin
      .from('academic_questions')
      .select('id, passage_id, difficulty, skill')
      .eq('active', true)
      .order('created_at', { ascending: true }),
    admin.from('academic_passages').select('id, cefr_level'),
  ]);
  if (aqErr) throw new Error(aqErr.message);
  if (pErr) throw new Error(pErr.message);
  const cefrByPassage = new Map((passages ?? []).map((p) => [p.id as string, p.cefr_level as string]));
  const orderInPassage = new Map<string, number>();

  return (aq ?? []).map((q) => {
    const passageId = q.passage_id as string;
    const questionOrder = orderInPassage.get(passageId) ?? 0;
    orderInPassage.set(passageId, questionOrder + 1);
    return {
      questionId: q.id as string,
      questionType: 'ACADEMIC' as const,
      skill: q.skill as ReadingSkill,
      difficulty: Number(q.difficulty),
      cefrLevel: cefrByPassage.get(passageId) ?? 'B1',
      passageId,
      questionOrder,
    };
  });
}

async function loadCandidates(admin: SupabaseClient): Promise<QuestionCandidate[]> {
  const [cw, dl, ac] = await Promise.all([
    loadCompleteWordsCandidates(admin),
    loadDailyLifeCandidates(admin),
    loadAcademicCandidates(admin),
  ]);
  return [...cw, ...dl, ...ac];
}

function expectedQuestionTypeForMode(mode: ReadingPracticeMode): ReadingQuestionType | null {
  if (mode === 'COMPLETE_WORDS') return 'COMPLETE_WORDS';
  if (mode === 'DAILY_LIFE') return 'DAILY_LIFE';
  if (mode === 'ACADEMIC') return 'ACADEMIC';
  return null;
}

function assertQuestionMatchesSessionMode(mode: ReadingPracticeMode, selected: QuestionCandidate): void {
  const expected = expectedQuestionTypeForMode(mode);
  if (expected && selected.questionType !== expected) {
    throw new Error(`wrong_question_type_for_mode:${expected}:${selected.questionType}`);
  }
}

async function loadCandidatesForMode(
  admin: SupabaseClient,
  mode: ReadingPracticeMode,
): Promise<QuestionCandidate[]> {
  if (mode === 'COMPLETE_WORDS') return loadCompleteWordsCandidates(admin);
  if (mode === 'DAILY_LIFE') return loadDailyLifeCandidates(admin);
  if (mode === 'ACADEMIC') return loadAcademicCandidates(admin);
  return loadCandidates(admin);
}

async function loadSessionQuestionIds(
  admin: SupabaseClient,
  sessionId: string,
): Promise<string[]> {
  const { data } = await admin
    .from('reading_attempts')
    .select('question_id')
    .eq('session_id', sessionId);
  return (data ?? []).map((r) => r.question_id as string);
}

async function resolveActivePassageId(
  admin: SupabaseClient,
  sessionId: string,
  currentPassageId: string | null,
  candidates: QuestionCandidate[],
  sessionQuestionIds: string[],
): Promise<string | null> {
  if (!currentPassageId) return null;

  const remaining = candidates.filter(
    (c) => c.passageId === currentPassageId && !sessionQuestionIds.includes(c.questionId),
  );
  if (remaining.length > 0) return currentPassageId;

  await admin
    .from('reading_practice_sessions')
    .update({ current_passage_id: null })
    .eq('id', sessionId);
  return null;
}

async function resolveActiveDailyLifeContextId(
  admin: SupabaseClient,
  sessionId: string,
  currentContextId: string | null,
  candidates: QuestionCandidate[],
  sessionQuestionIds: string[],
): Promise<string | null> {
  if (!currentContextId) return null;

  const remaining = candidates.filter(
    (c) => c.contextId === currentContextId && !sessionQuestionIds.includes(c.questionId),
  );
  if (remaining.length > 0) return currentContextId;

  await admin
    .from('reading_practice_sessions')
    .update({ current_daily_life_context_id: null })
    .eq('id', sessionId);
  return null;
}

export async function buildStudentPayload(
  admin: SupabaseClient,
  selected: QuestionCandidate,
  sessionPassageId?: string | null,
): Promise<StudentQuestionPayload> {
  if (selected.questionType === 'COMPLETE_WORDS') {
    const { data: q } = await admin
      .from('complete_words_questions')
      .select('id, sentence, difficulty, category')
      .eq('id', selected.questionId)
      .single();
    if (!q) throw new Error('question_not_found');
    const task = buildCompleteWordsTask(q.sentence as string);
    if (task.blanks.length !== DEFAULT_MASK_BLANK_COUNT) {
      throw new Error('invalid_passage_blank_count');
    }
    return {
      questionType: 'COMPLETE_WORDS',
      questionId: q.id as string,
      skill: 'VOCABULARY',
      difficulty: Number(q.difficulty),
      displayPassage: task.displayPassage,
      displaySentence: task.displayPassage,
      blanks: toStudentBlanks(task.blanks),
    };
  }

  if (selected.questionType === 'DAILY_LIFE') {
    const { data: q } = await admin
      .from('daily_life_questions')
      .select(
        'id, context_id, title, content, content_type, difficulty, skill, question, option_a, option_b, option_c, option_d',
      )
      .eq('id', selected.questionId)
      .single();
    if (!q) throw new Error('question_not_found');

    const contextId = (q.context_id as string | null) ?? selected.contextId ?? null;
    let title = q.title as string;
    let content = q.content as string;
    let contentType = q.content_type as string;

    if (contextId) {
      const { data: ctx } = await admin
        .from('daily_life_contexts')
        .select('id, title, content, content_type')
        .eq('id', contextId)
        .single();
      if (ctx) {
        title = ctx.title as string;
        content = ctx.content as string;
        contentType = ctx.content_type as string;
      }
    }

    let questionIndex = (selected.questionOrder ?? 0) + 1;
    let questionsInContext = 1;
    if (contextId) {
      const { count } = await admin
        .from('daily_life_questions')
        .select('id', { count: 'exact', head: true })
        .eq('context_id', contextId)
        .eq('active', true);

      const { data: ordered } = await admin
        .from('daily_life_questions')
        .select('id')
        .eq('context_id', contextId)
        .eq('active', true)
        .order('created_at', { ascending: true });

      const idx = (ordered ?? []).findIndex((row) => row.id === q.id);
      questionIndex = idx >= 0 ? idx + 1 : questionIndex;
      questionsInContext = count ?? 1;
    }

    return {
      questionType: 'DAILY_LIFE',
      questionId: q.id as string,
      skill: q.skill as ReadingSkill,
      difficulty: Number(q.difficulty),
      title,
      content,
      contentType,
      contextId: contextId ?? undefined,
      questionText: q.question as string,
      options: mcqOptions(q),
      questionIndex,
      questionsInContext,
    };
  }

  const passageId = selected.passageId ?? sessionPassageId;
  const { data: q } = await admin
    .from('academic_questions')
    .select('id, passage_id, difficulty, skill, question, option_a, option_b, option_c, option_d')
    .eq('id', selected.questionId)
    .single();
  if (!q) throw new Error('question_not_found');

  const { data: passage } = await admin
    .from('academic_passages')
    .select('id, title, passage_text')
    .eq('id', passageId ?? q.passage_id)
    .single();

  const { count } = await admin
    .from('academic_questions')
    .select('id', { count: 'exact', head: true })
    .eq('passage_id', passageId ?? q.passage_id)
    .eq('active', true);

  const { data: ordered } = await admin
    .from('academic_questions')
    .select('id')
    .eq('passage_id', passageId ?? q.passage_id)
    .eq('active', true)
    .order('created_at', { ascending: true });

  const idx = (ordered ?? []).findIndex((row) => row.id === q.id);

  return {
    questionType: 'ACADEMIC',
    questionId: q.id as string,
    skill: q.skill as ReadingSkill,
    difficulty: Number(q.difficulty),
    passageId: passage?.id as string,
    title: passage?.title as string,
    passageText: passage?.passage_text as string,
    questionText: q.question as string,
    options: mcqOptions(q),
    questionIndex: idx >= 0 ? idx + 1 : 1,
    questionsInPassage: count ?? 1,
  };
}

function mcqOptions(q: Record<string, unknown>) {
  return (
    ['A', 'B', 'C', 'D'] as const
  ).map((key) => ({
    key,
    label: q[`option_${key.toLowerCase()}`] as string,
  }));
}

function normalizeStartMode(mode: ReadingPracticeMode): ReadingPracticeMode {
  // ADAPTIVE (legacy chained test) is deprecated — each task type is its own session.
  return mode === 'ADAPTIVE' ? 'COMPLETE_WORDS' : mode;
}

export async function startSession(
  admin: SupabaseClient,
  studentId: string,
  officialCefr: string,
  mode: ReadingPracticeMode,
  length: number = DEFAULT_SESSION_LENGTH,
) {
  const sessionMode = normalizeStartMode(mode);
  const profile = await ensureReadingProfile(admin, studentId, officialCefr);
  const targetLength = effectiveSessionLength(length, sessionMode);
  const isPlacement = sessionMode === 'COMPLETE_WORDS';
  const startDiff = isPlacement ? PLACEMENT_START_DIFFICULTY : profile.overall_reading_difficulty;

  const { data: session, error } = await admin
    .from('reading_practice_sessions')
    .insert({
      student_id: studentId,
      mode: sessionMode,
      target_length: targetLength,
      starting_difficulty: startDiff,
      session_difficulty: startDiff,
      highest_difficulty_reached: startDiff,
      status: 'active',
    })
    .select('*')
    .single();
  if (error) throw error;
  return { session, profile };
}

export async function getNextQuestion(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
): Promise<{ payload: StudentQuestionPayload; session: Record<string, unknown> }> {
  const { data: session } = await admin
    .from('reading_practice_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (!session || session.status !== 'active') throw new Error('invalid_session');

  const mode = session.mode as ReadingPracticeMode;

  const [{ data: student }, recentQuestionIds, sessionQuestionIds, candidates] = await Promise.all([
    admin.from('students').select('level').eq('id', studentId).single(),
    loadRecentQuestionIds(admin, studentId),
    loadSessionQuestionIds(admin, sessionId),
    loadCandidatesForMode(admin, mode),
  ]);
  const profile = await ensureReadingProfile(admin, studentId, (student?.level as string) ?? 'A1');
  if (candidates.length === 0) {
    throw new Error(
      mode === 'DAILY_LIFE'
        ? 'no_daily_life_questions'
        : mode === 'ACADEMIC'
          ? 'no_academic_questions'
          : 'no_questions',
    );
  }
  const targetLength = Number(session.target_length ?? DEFAULT_SESSION_LENGTH);
  const questionIndex = Number(session.questions_answered ?? 0);
  const sectionMeta = buildSectionMeta(mode, targetLength, questionIndex);
  const forcedQuestionType = sectionMeta?.sectionType;

  if (forcedQuestionType !== 'ACADEMIC' && session.current_passage_id) {
    await admin
      .from('reading_practice_sessions')
      .update({ current_passage_id: null })
      .eq('id', sessionId);
    session.current_passage_id = null;
  }

  if (mode !== 'DAILY_LIFE' && session.current_daily_life_context_id) {
    await admin
      .from('reading_practice_sessions')
      .update({ current_daily_life_context_id: null })
      .eq('id', sessionId);
    session.current_daily_life_context_id = null;
  }

  let activePassageId: string | null = null;
  if (mode === 'ACADEMIC' || forcedQuestionType === 'ACADEMIC') {
    activePassageId = await resolveActivePassageId(
      admin,
      sessionId,
      session.current_passage_id as string | null,
      candidates,
      sessionQuestionIds,
    );
    if (activePassageId !== session.current_passage_id) {
      session.current_passage_id = activePassageId;
    }
  }

  let activeContextId: string | null = null;
  if (mode === 'DAILY_LIFE') {
    activeContextId = await resolveActiveDailyLifeContextId(
      admin,
      sessionId,
      session.current_daily_life_context_id as string | null,
      candidates,
      sessionQuestionIds,
    );
    if (activeContextId !== session.current_daily_life_context_id) {
      session.current_daily_life_context_id = activeContextId;
    }
  }

  const sessionDifficulty = Number(
    session.session_difficulty ?? session.starting_difficulty ?? PLACEMENT_START_DIFFICULTY,
  );

  let selected: QuestionCandidate | null = null;
  if (mode === 'COMPLETE_WORDS') {
    selected = selectCompleteWordsByPool(
      candidates,
      sessionDifficulty,
      sessionQuestionIds,
      recentQuestionIds,
    );
  } else {
    selected = selectQuestion({
      mode,
      profile,
      recentQuestionIds,
      sessionQuestionIds,
      candidates,
      activePassageId,
      activeContextId,
      forcedQuestionType,
    });
  }
  if (!selected) {
    throw new Error(
      mode === 'DAILY_LIFE'
        ? 'no_eligible_daily_life_question'
        : mode === 'ACADEMIC'
          ? 'no_eligible_academic_question'
          : 'no_eligible_question',
    );
  }
  assertQuestionMatchesSessionMode(mode, selected);

  if (selected.questionType === 'ACADEMIC' && selected.passageId && !session.current_passage_id) {
    await admin
      .from('reading_practice_sessions')
      .update({ current_passage_id: selected.passageId })
      .eq('id', sessionId);
    session.current_passage_id = selected.passageId;
  }

  if (
    selected.questionType === 'DAILY_LIFE' &&
    selected.contextId &&
    !session.current_daily_life_context_id
  ) {
    await admin
      .from('reading_practice_sessions')
      .update({ current_daily_life_context_id: selected.contextId })
      .eq('id', sessionId);
    session.current_daily_life_context_id = selected.contextId;
  }

  await admin.from('reading_question_history').insert({
    student_id: studentId,
    question_id: selected.questionId,
    question_type: selected.questionType,
  });

  const payload = await buildStudentPayload(
    admin,
    selected,
    session.current_passage_id as string | null,
  );
  if (sectionMeta) {
    payload.sectionMeta = sectionMeta;
  }

  if (mode === 'COMPLETE_WORDS') {
    const questionNumber = questionIndex + 1;
    payload.placementMeta = {
      questionNumber,
      totalQuestions: targetLength,
      sessionDifficulty,
      poolLabel: poolForDifficulty(sessionDifficulty).label,
    };
  }

  return { payload, session };
}

function missedWordsFromGradedWords(words: GradedWord[]): MissedWordReport[] {
  return words
    .filter((w) => w.errorType !== 'EXACT' && w.errorType !== 'ACCEPTED_VARIANT')
    .map((w) => ({
      word: w.correctAnswer,
      submitted: w.studentAnswer === '—' ? null : w.studentAnswer,
      result: w.result,
      wordScore: w.wordScore,
      errorType: w.errorType,
    }));
}

export async function submitAnswer(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
  questionId: string,
  questionType: ReadingQuestionType,
  answer: string,
  responseTimeMs?: number,
): Promise<{ correct: boolean; explanation: string | null }> {
  const { data: priorAttempt } = await admin
    .from('reading_attempts')
    .select('correct')
    .eq('session_id', sessionId)
    .eq('question_id', questionId)
    .maybeSingle();

  let correct = false;
  let explanation: string | null = null;
  let skill: ReadingSkill | null = null;
  let difficulty = 4;
  let cefrLevel = 'B1';
  let blankResults: { id: number; correct: boolean; expectedWord: string }[] | undefined;
  let missedWords: MissedWordReport[] | null = null;
  let storedAnswer = answer;
  let passageScore = 0;
  let hasWrongWord = false;
  let gradedWords: GradedWord[] | undefined;

  if (questionType === 'COMPLETE_WORDS') {
    const { data: q } = await admin
      .from('complete_words_questions')
      .select('*')
      .eq('id', questionId)
      .single();
    if (!q) throw new Error('question_not_found');
    const task = buildCompleteWordsTask(q.sentence as string);
    const submitted = parseCompleteWordsSubmission(answer);
    const graded = gradeCompleteWordsAnswer(task.blanks, submitted);
    blankResults = graded.results;
    gradedWords = graded.words;
    passageScore = graded.passageScore;
    hasWrongWord = graded.hasWrongWord;
    missedWords = missedWordsFromGradedWords(graded.words);
    correct = priorAttempt ? (priorAttempt.correct as boolean) : graded.correct;
    explanation = q.explanation as string | null;
    skill = 'VOCABULARY';
    difficulty = Number(q.difficulty);
    cefrLevel = q.cefr_level as string;
  } else if (questionType === 'DAILY_LIFE') {
    const { data: q } = await admin
      .from('daily_life_questions')
      .select('*')
      .eq('id', questionId)
      .single();
    if (!q) throw new Error('question_not_found');
    correct = priorAttempt
      ? (priorAttempt.correct as boolean)
      : checkMcqAnswer(answer, q.correct_option as string);
    explanation = q.explanation as string | null;
    skill = q.skill as ReadingSkill;
    difficulty = Number(q.difficulty);
    cefrLevel = q.cefr_level as string;
  } else {
    const { data: q } = await admin
      .from('academic_questions')
      .select('*, academic_passages(cefr_level)')
      .eq('id', questionId)
      .single();
    if (!q) throw new Error('question_not_found');
    correct = priorAttempt
      ? (priorAttempt.correct as boolean)
      : checkMcqAnswer(answer, q.correct_option as string);
    explanation = q.explanation as string | null;
    skill = q.skill as ReadingSkill;
    difficulty = Number(q.difficulty);
    const passage = q.academic_passages as { cefr_level: string } | null;
    cefrLevel = passage?.cefr_level ?? 'B1';
  }

  if (priorAttempt) {
    return { correct, explanation: questionType === 'COMPLETE_WORDS' ? null : explanation };
  }

  const { data: sessionRowBefore } = await admin
    .from('reading_practice_sessions')
    .select(
      'mode, session_difficulty, starting_difficulty, highest_difficulty_reached, questions_answered, questions_correct, target_length',
    )
    .eq('id', sessionId)
    .single();

  const sessionModeBefore = (sessionRowBefore?.mode as ReadingPracticeMode) ?? 'ADAPTIVE';
  const isPlacementBefore =
    sessionModeBefore === 'COMPLETE_WORDS' && questionType === 'COMPLETE_WORDS';
  const sessionDifficultyBefore = Number(
    sessionRowBefore?.session_difficulty ??
      sessionRowBefore?.starting_difficulty ??
      PLACEMENT_START_DIFFICULTY,
  );

  if (questionType === 'COMPLETE_WORDS' && gradedWords) {
    const submitted = parseCompleteWordsSubmission(answer);
    const sessionDifficultyAfter = isPlacementBefore
      ? adjustSessionDifficultyFromPassageScore(sessionDifficultyBefore, passageScore)
      : sessionDifficultyBefore;
    storedAnswer = JSON.stringify({
      blanks: submitted,
      passageScore,
      sessionDifficultyBefore,
      sessionDifficultyAfter,
      questionDifficulty: difficulty,
      hasWrongWord,
      words: gradedWords.map((w) => ({
        targetWord: w.targetWord,
        studentAnswer: w.studentAnswer,
        correctAnswer: w.correctAnswer,
        wordScore: w.wordScore,
        errorType: w.errorType,
        feedback: w.feedback,
      })),
    });
  }

  await admin.from('reading_attempts').insert({
    student_id: studentId,
    session_id: sessionId,
    question_id: questionId,
    question_type: questionType,
    skill,
    cefr_level: cefrLevel,
    difficulty,
    answer: storedAnswer,
    correct,
    response_time_ms: responseTimeMs ?? null,
    missed_words: missedWords,
  });

  await admin
    .from('reading_question_history')
    .update({
      answered_at: new Date().toISOString(),
      correct,
      response_time_ms: responseTimeMs ?? null,
    })
    .eq('student_id', studentId)
    .eq('question_id', questionId)
    .is('answered_at', null);

  const sessionRow = sessionRowBefore;
  const sessionMode = sessionModeBefore;
  const isPlacement = isPlacementBefore;
  const currentSessionDiff = sessionDifficultyBefore;
  const newSessionDiff =
    isPlacement && questionType === 'COMPLETE_WORDS'
      ? adjustSessionDifficultyFromPassageScore(currentSessionDiff, passageScore)
      : currentSessionDiff;
  const prevHighest = Number(sessionRow?.highest_difficulty_reached ?? currentSessionDiff);
  const newHighest = isPlacement ? Math.max(prevHighest, difficulty) : prevHighest;

  if (isPlacement && questionType === 'COMPLETE_WORDS') {
    const questionNumber = ((sessionRow?.questions_answered as number) ?? 0) + 1;
    console.log('[CW adaptive]', {
      questionNumber,
      sessionDifficultyBefore: currentSessionDiff,
      questionDifficulty: difficulty,
      passageScore,
      adaptiveStep:
        passageScore >= 85 ? '+1' : passageScore >= 50 ? 'hold' : '-1',
      sessionDifficultyAfter: newSessionDiff,
      selectedNextDifficulty: newSessionDiff,
    });
  }

  await updateProfileAfterAttempt(
    admin,
    studentId,
    questionType,
    skill,
    difficulty,
    correct,
    isPlacement,
  );

  if (questionType === 'COMPLETE_WORDS' && missedWords) {
    for (const missed of missedWords) {
      await updateWordPerformance(admin, studentId, questionId, missed.word, false);
    }
    if (correct) {
      await updateWordPerformance(admin, studentId, questionId, '__passage__', true);
    }
  }

  const answered = ((sessionRow?.questions_answered as number) ?? 0) + 1;
  const correctCount = ((sessionRow?.questions_correct as number) ?? 0) + (correct ? 1 : 0);

  await admin
    .from('reading_practice_sessions')
    .update({
      questions_answered: answered,
      questions_correct: correctCount,
      ...(isPlacement
        ? {
            session_difficulty: newSessionDiff,
            highest_difficulty_reached: newHighest,
          }
        : {}),
    })
    .eq('id', sessionId);

  return {
    correct,
    explanation: questionType === 'COMPLETE_WORDS' ? null : explanation,
  };
}

async function updateProfileAfterAttempt(
  admin: SupabaseClient,
  studentId: string,
  questionType: ReadingQuestionType,
  skill: ReadingSkill | null,
  difficulty: number,
  correct: boolean,
  skipDifficultyAdjust = false,
) {
  const { data: profile } = await admin
    .from('reading_practice_profiles')
    .select('*')
    .eq('student_id', studentId)
    .single();
  if (!profile) return;

  const { data: recent } = await admin
    .from('reading_attempts')
    .select('correct')
    .eq('student_id', studentId)
    .order('attempted_at', { ascending: false })
    .limit(RECENT_WINDOW);

  const recentCorrect = (recent ?? []).map((r) => r.correct as boolean).reverse();

  const typeField =
    questionType === 'COMPLETE_WORDS'
      ? 'complete_words_difficulty'
      : questionType === 'DAILY_LIFE'
        ? 'daily_life_difficulty'
        : 'academic_difficulty';

  const updates: Record<string, unknown> = {
    total_attempts: Number(profile.total_attempts) + 1,
    total_correct: Number(profile.total_correct) + (correct ? 1 : 0),
    last_practice_at: new Date().toISOString(),
    highest_difficulty: Math.max(Number(profile.highest_difficulty), difficulty),
  };

  if (!skipDifficultyAdjust) {
    const newTypeDiff = adjustDifficulty(Number(profile[typeField]), recentCorrect);
    const newOverall = adjustDifficulty(Number(profile.overall_reading_difficulty), recentCorrect);
    updates[typeField] = newTypeDiff;
    updates.overall_reading_difficulty = newOverall;
  }

  updates.overall_accuracy =
    (Number(updates.total_correct) / Number(updates.total_attempts)) * 100;

  if (skill === 'VOCABULARY') updates.vocabulary_score = updateSkillScore(Number(profile.vocabulary_score), correct);
  if (skill === 'SPELLING') updates.spelling_score = updateSkillScore(Number(profile.spelling_score), correct);
  if (skill === 'MAIN_IDEA') updates.main_idea_score = updateSkillScore(Number(profile.main_idea_score), correct);
  if (skill === 'DETAIL') updates.detail_score = updateSkillScore(Number(profile.detail_score), correct);
  if (skill === 'INFERENCE') updates.inference_score = updateSkillScore(Number(profile.inference_score), correct);
  if (skill === 'VOCABULARY_CONTEXT')
    updates.vocabulary_context_score = updateSkillScore(Number(profile.vocabulary_context_score), correct);
  if (skill === 'PURPOSE') updates.purpose_score = updateSkillScore(Number(profile.purpose_score), correct);

  await admin.from('reading_practice_profiles').update(updates).eq('student_id', studentId);
}

async function updateWordPerformance(
  admin: SupabaseClient,
  studentId: string,
  questionId: string,
  word: string,
  correct: boolean,
) {
  const { data: row } = await admin
    .from('complete_words_word_performance')
    .select('*')
    .eq('student_id', studentId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (!row) {
    const mastery = updateMastery(0, correct);
    await admin.from('complete_words_word_performance').insert({
      student_id: studentId,
      question_id: questionId,
      word,
      attempts: 1,
      correct_count: correct ? 1 : 0,
      incorrect_count: correct ? 0 : 1,
      accuracy: correct ? 100 : 0,
      mastery_score: mastery,
      consecutive_correct: correct ? 1 : 0,
      consecutive_incorrect: correct ? 0 : 1,
      last_attempted_at: new Date().toISOString(),
      last_correct_at: correct ? new Date().toISOString() : null,
    });
    return;
  }

  const attempts = Number(row.attempts) + 1;
  const correctCount = Number(row.correct_count) + (correct ? 1 : 0);
  const incorrectCount = Number(row.incorrect_count) + (correct ? 0 : 1);
  const mastery = updateMastery(Number(row.mastery_score), correct);

  await admin.from('complete_words_word_performance').update({
    attempts,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    accuracy: (correctCount / attempts) * 100,
    mastery_score: mastery,
    consecutive_correct: correct ? Number(row.consecutive_correct) + 1 : 0,
    consecutive_incorrect: correct ? 0 : Number(row.consecutive_incorrect) + 1,
    last_attempted_at: new Date().toISOString(),
    last_correct_at: correct ? new Date().toISOString() : row.last_correct_at,
  }).eq('student_id', studentId).eq('question_id', questionId);
}

export async function finishSession(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
): Promise<SessionResultsSummary> {
  const { data: session } = await admin
    .from('reading_practice_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .single();
  if (!session) throw new Error('invalid_session');

  const isPlacement = session.mode === 'COMPLETE_WORDS';
  const ending = isPlacement
    ? Number(session.session_difficulty ?? session.starting_difficulty)
    : (
        await admin
          .from('reading_practice_profiles')
          .select('overall_reading_difficulty')
          .eq('student_id', studentId)
          .single()
      ).data?.overall_reading_difficulty ?? session.starting_difficulty;
  const completedAt = new Date().toISOString();

  const { data: student } = await admin
    .from('students')
    .select('level')
    .eq('id', studentId)
    .single();
  const studentLevel = (student?.level as string) ?? 'A1';

  const summary = await buildSessionResultsReport(
    admin,
    studentId,
    sessionId,
    { ...session, completed_at: completedAt, status: 'completed' },
    studentLevel,
    Number(ending),
  );

  await admin
    .from('reading_practice_sessions')
    .update({
      status: 'completed',
      completed_at: completedAt,
      ending_difficulty: ending,
      results_report: summary,
    })
    .eq('id', sessionId);

  if (isPlacement) {
    await admin
      .from('reading_practice_profiles')
      .update({
        complete_words_difficulty: ending,
        last_practice_at: completedAt,
      })
      .eq('student_id', studentId);
  }

  return summary;
}
