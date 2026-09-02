import type { SupabaseClient } from '@supabase/supabase-js';
import { maskTargetWord, answersMatch, checkMcqAnswer } from './readingPractice/completeWords.js';
import {
  adjustDifficulty,
  cefrToStartingDifficulty,
  updateMastery,
  updateSkillScore,
} from './readingPractice/difficulty.js';
import { selectQuestion, summarizeSkills } from './readingPractice/selection.js';
import type {
  QuestionCandidate,
  ReadingPracticeMode,
  ReadingPracticeProfile,
  ReadingQuestionType,
  ReadingSkill,
  SessionResultsSummary,
  StudentQuestionPayload,
} from './readingPractice/types.js';
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

export async function assertToeflStudent(
  admin: SupabaseClient,
  userId: string,
): Promise<{ studentId: string; level: string; examTrack: string | null }> {
  const { data: student } = await admin
    .from('students')
    .select('id, level, exam_track, user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!student) throw new Error('not_a_student');
  if (student.exam_track !== 'toefl') throw new Error('toefl_only');
  return {
    studentId: student.id as string,
    level: (student.level as string) || 'A1',
    examTrack: student.exam_track as string | null,
  };
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

async function loadCandidates(admin: SupabaseClient): Promise<QuestionCandidate[]> {
  const out: QuestionCandidate[] = [];

  const { data: cw, error: cwErr } = await admin
    .from('complete_words_questions')
    .select('id, cefr_level, difficulty, category')
    .eq('active', true);
  if (cwErr) throw new Error(cwErr.message);
  for (const q of cw ?? []) {
    out.push({
      questionId: q.id as string,
      questionType: 'COMPLETE_WORDS',
      skill: 'VOCABULARY',
      difficulty: Number(q.difficulty),
      cefrLevel: q.cefr_level as string,
    });
  }

  const { data: dl, error: dlErr } = await admin
    .from('daily_life_questions')
    .select('id, cefr_level, difficulty, skill')
    .eq('active', true);
  if (dlErr) throw new Error(dlErr.message);
  for (const q of dl ?? []) {
    out.push({
      questionId: q.id as string,
      questionType: 'DAILY_LIFE',
      skill: q.skill as ReadingSkill,
      difficulty: Number(q.difficulty),
      cefrLevel: q.cefr_level as string,
    });
  }

  const { data: aq, error: aqErr } = await admin
    .from('academic_questions')
    .select('id, passage_id, difficulty, skill')
    .eq('active', true);
  if (aqErr) throw new Error(aqErr.message);

  const { data: passages, error: pErr } = await admin
    .from('academic_passages')
    .select('id, cefr_level');
  if (pErr) throw new Error(pErr.message);
  const cefrByPassage = new Map((passages ?? []).map((p) => [p.id as string, p.cefr_level as string]));

  for (const q of aq ?? []) {
    out.push({
      questionId: q.id as string,
      questionType: 'ACADEMIC',
      skill: q.skill as ReadingSkill,
      difficulty: Number(q.difficulty),
      cefrLevel: cefrByPassage.get(q.passage_id as string) ?? 'B1',
      passageId: q.passage_id as string,
    });
  }

  return out;
}

export async function buildStudentPayload(
  admin: SupabaseClient,
  selected: QuestionCandidate,
  sessionPassageId?: string | null,
): Promise<StudentQuestionPayload> {
  if (selected.questionType === 'COMPLETE_WORDS') {
    const { data: q } = await admin
      .from('complete_words_questions')
      .select('id, sentence, target_word, difficulty, category')
      .eq('id', selected.questionId)
      .single();
    if (!q) throw new Error('question_not_found');
    const displaySentence = maskTargetWord(
      q.sentence as string,
      q.target_word as string,
      Number(q.difficulty),
    );
    return {
      questionType: 'COMPLETE_WORDS',
      questionId: q.id as string,
      skill: 'VOCABULARY',
      difficulty: Number(q.difficulty),
      displaySentence,
    };
  }

  if (selected.questionType === 'DAILY_LIFE') {
    const { data: q } = await admin
      .from('daily_life_questions')
      .select('id, title, content, content_type, difficulty, skill, question, option_a, option_b, option_c, option_d')
      .eq('id', selected.questionId)
      .single();
    if (!q) throw new Error('question_not_found');
    return {
      questionType: 'DAILY_LIFE',
      questionId: q.id as string,
      skill: q.skill as ReadingSkill,
      difficulty: Number(q.difficulty),
      title: q.title as string,
      content: q.content as string,
      contentType: q.content_type as string,
      questionText: q.question as string,
      options: mcqOptions(q),
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

export async function startSession(
  admin: SupabaseClient,
  studentId: string,
  officialCefr: string,
  mode: ReadingPracticeMode,
  length: number = DEFAULT_SESSION_LENGTH,
) {
  const profile = await ensureReadingProfile(admin, studentId, officialCefr);
  const { data: session, error } = await admin
    .from('reading_practice_sessions')
    .insert({
      student_id: studentId,
      mode,
      target_length: length,
      starting_difficulty: profile.overall_reading_difficulty,
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

  const { data: student } = await admin.from('students').select('level').eq('id', studentId).single();
  const profile = await ensureReadingProfile(admin, studentId, (student?.level as string) ?? 'A1');

  const recentQuestionIds = await loadRecentQuestionIds(admin, studentId);
  const candidates = await loadCandidates(admin);
  if (candidates.length === 0) throw new Error('no_questions');

  const selected = selectQuestion({
    mode: session.mode as ReadingPracticeMode,
    profile,
    recentQuestionIds,
    candidates,
    activePassageId: session.current_passage_id as string | null,
  });
  if (!selected) throw new Error('no_eligible_question');

  if (selected.questionType === 'ACADEMIC' && selected.passageId && !session.current_passage_id) {
    await admin
      .from('reading_practice_sessions')
      .update({ current_passage_id: selected.passageId })
      .eq('id', sessionId);
    session.current_passage_id = selected.passageId;
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

  return { payload, session };
}

export async function submitAnswer(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
  questionId: string,
  questionType: ReadingQuestionType,
  answer: string,
  responseTimeMs?: number,
): Promise<{ correct: boolean; explanation: string | null; reveal?: string }> {
  let correct = false;
  let explanation: string | null = null;
  let skill: ReadingSkill | null = null;
  let difficulty = 4;
  let cefrLevel = 'B1';
  let targetWord: string | null = null;

  if (questionType === 'COMPLETE_WORDS') {
    const { data: q } = await admin
      .from('complete_words_questions')
      .select('*')
      .eq('id', questionId)
      .single();
    if (!q) throw new Error('question_not_found');
    correct = answersMatch(answer, q.target_word as string);
    explanation = q.explanation as string | null;
    skill = 'VOCABULARY';
    difficulty = Number(q.difficulty);
    cefrLevel = q.cefr_level as string;
    targetWord = q.target_word as string;
  } else if (questionType === 'DAILY_LIFE') {
    const { data: q } = await admin
      .from('daily_life_questions')
      .select('*')
      .eq('id', questionId)
      .single();
    if (!q) throw new Error('question_not_found');
    correct = checkMcqAnswer(answer, q.correct_option as string);
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
    correct = checkMcqAnswer(answer, q.correct_option as string);
    explanation = q.explanation as string | null;
    skill = q.skill as ReadingSkill;
    difficulty = Number(q.difficulty);
    const passage = q.academic_passages as { cefr_level: string } | null;
    cefrLevel = passage?.cefr_level ?? 'B1';
  }

  await admin.from('reading_attempts').insert({
    student_id: studentId,
    session_id: sessionId,
    question_id: questionId,
    question_type: questionType,
    skill,
    cefr_level: cefrLevel,
    difficulty,
    answer,
    correct,
    response_time_ms: responseTimeMs ?? null,
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

  await updateProfileAfterAttempt(admin, studentId, questionType, skill, difficulty, correct);

  if (questionType === 'COMPLETE_WORDS' && targetWord) {
    await updateWordPerformance(admin, studentId, questionId, targetWord, correct);
  }

  const { data: session } = await admin
    .from('reading_practice_sessions')
    .select('questions_answered, questions_correct, target_length')
    .eq('id', sessionId)
    .single();

  const answered = ((session?.questions_answered as number) ?? 0) + 1;
  const correctCount = ((session?.questions_correct as number) ?? 0) + (correct ? 1 : 0);

  await admin
    .from('reading_practice_sessions')
    .update({
      questions_answered: answered,
      questions_correct: correctCount,
    })
    .eq('id', sessionId);

  return {
    correct,
    explanation,
    reveal: questionType === 'COMPLETE_WORDS' ? targetWord ?? undefined : undefined,
  };
}

async function updateProfileAfterAttempt(
  admin: SupabaseClient,
  studentId: string,
  questionType: ReadingQuestionType,
  skill: ReadingSkill | null,
  difficulty: number,
  correct: boolean,
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

  const newTypeDiff = adjustDifficulty(Number(profile[typeField]), recentCorrect);
  const newOverall = adjustDifficulty(Number(profile.overall_reading_difficulty), recentCorrect);

  const updates: Record<string, unknown> = {
    [typeField]: newTypeDiff,
    overall_reading_difficulty: newOverall,
    total_attempts: Number(profile.total_attempts) + 1,
    total_correct: Number(profile.total_correct) + (correct ? 1 : 0),
    last_practice_at: new Date().toISOString(),
    highest_difficulty: Math.max(Number(profile.highest_difficulty), difficulty),
  };

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

  const { data: profile } = await admin
    .from('reading_practice_profiles')
    .select('overall_reading_difficulty')
    .eq('student_id', studentId)
    .single();

  const ending = profile?.overall_reading_difficulty ?? session.starting_difficulty;

  await admin
    .from('reading_practice_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      ending_difficulty: ending,
    })
    .eq('id', sessionId);

  const { data: attempts } = await admin
    .from('reading_attempts')
    .select('question_type, skill, correct')
    .eq('session_id', sessionId);

  const list = attempts ?? [];
  const questions = list.length;
  const correct = list.filter((a) => a.correct).length;
  const { strongest, weakest } = summarizeSkills(
    list.map((a) => ({ skill: a.skill as ReadingSkill | null, correct: a.correct as boolean })),
  );

  const byType = {
    COMPLETE_WORDS: tally(list, 'COMPLETE_WORDS'),
    DAILY_LIFE: tally(list, 'DAILY_LIFE'),
    ACADEMIC: tally(list, 'ACADEMIC'),
  };

  return {
    questions,
    correct,
    accuracy: questions ? Math.round((correct / questions) * 100) : 0,
    startingDifficulty: Number(session.starting_difficulty),
    endingDifficulty: Number(ending),
    strongestSkill: strongest,
    weakestSkill: weakest,
    byType,
  };
}

function tally(list: { question_type: string; correct: boolean }[], type: ReadingQuestionType) {
  const subset = list.filter((a) => a.question_type === type);
  const total = subset.length;
  const c = subset.filter((a) => a.correct).length;
  return { total, correct: c, accuracy: total ? Math.round((c / total) * 100) : 0 };
}
