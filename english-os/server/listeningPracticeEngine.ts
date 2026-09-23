import type { SupabaseClient } from '@supabase/supabase-js';
import { checkMcqAnswer } from './readingPractice/completeWords.js';
import { assertToeflStudent } from './readingPracticeEngine.js';
import {
  difficultyRangeForLowerModule,
  difficultyRangeForUpperBand,
  moduleItemTarget,
  pickTaskTypeForSlot,
  routeUpperBand,
} from './listeningPractice/modulePlan.js';
import { pickStimulus, type StimulusCandidate } from './listeningPractice/selection.js';
import { buildListeningSessionSummary } from './listeningPractice/sessionReport.js';
import type {
  ListeningModulePhase,
  ListeningQuestionRow,
  ListeningStepPayload,
  ListeningTaskType,
  SpeakerPortrait,
} from './listeningPractice/types.js';

export { assertToeflStudent };

const AUDIO_BUCKET = 'listening-audio';
const SPEAKER_BUCKET = 'listening-speakers';
const SIGNED_URL_TTL = 3600;

async function signedUrl(admin: SupabaseClient, bucket: string, path: string): Promise<string> {
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) throw new Error('audio_unavailable');
  return data.signedUrl;
}

async function loadStimulusCandidates(admin: SupabaseClient): Promise<StimulusCandidate[]> {
  const [{ data: stimuli, error: sErr }, { data: questions, error: qErr }] = await Promise.all([
    admin
      .from('listening_stimuli')
      .select('*')
      .eq('active', true),
    admin.from('listening_questions').select('stimulus_id').eq('active', true),
  ]);
  if (sErr) throw new Error(sErr.message);
  if (qErr) throw new Error(qErr.message);

  const counts = new Map<string, number>();
  for (const q of questions ?? []) {
    const sid = q.stimulus_id as string;
    counts.set(sid, (counts.get(sid) ?? 0) + 1);
  }

  return (stimuli ?? []).map((s) => ({
    ...(s as StimulusCandidate),
    speaker_portraits: (s.speaker_portraits ?? []) as SpeakerPortrait[],
    overall_difficulty: Number(s.overall_difficulty),
    questionCount: counts.get(s.id as string) ?? 0,
  }));
}

async function loadQuestionsForStimulus(
  admin: SupabaseClient,
  stimulusId: string,
): Promise<ListeningQuestionRow[]> {
  const { data, error } = await admin
    .from('listening_questions')
    .select('*')
    .eq('stimulus_id', stimulusId)
    .eq('active', true)
    .order('order_index', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((q) => ({
    ...(q as ListeningQuestionRow),
    difficulty: Number(q.difficulty),
  }));
}

function difficultyRangeForSession(
  phase: ListeningModulePhase,
  upperBand: number | null,
): { min: number; max: number } {
  if (phase === 'LOWER') return difficultyRangeForLowerModule();
  const band = (upperBand ?? 2) as 1 | 2 | 3;
  return difficultyRangeForUpperBand(band);
}

async function buildStimulusPayload(
  admin: SupabaseClient,
  stimulus: StimulusCandidate,
  questionCount: number,
  modulePhase: ListeningModulePhase,
): Promise<ListeningStepPayload> {
  const speakers = await Promise.all(
    (stimulus.speaker_portraits ?? []).map(async (p) => ({
      name: p.name,
      role: p.role,
      imageUrl: p.imagePath ? await signedUrl(admin, SPEAKER_BUCKET, p.imagePath) : null,
    })),
  );

  return {
    kind: 'STIMULUS',
    stimulusId: stimulus.id,
    taskType: stimulus.task_type,
    title: stimulus.title,
    audioUrl: await signedUrl(admin, AUDIO_BUCKET, stimulus.audio_path),
    durationSeconds: stimulus.duration_seconds,
    speakers,
    questionCount,
    modulePhase,
    hideSpokenPromptText: stimulus.task_type === 'CHOOSE_RESPONSE',
    notesAllowed: true,
  };
}

function countModuleItemsAnswered(
  session: Record<string, unknown>,
  phase: ListeningModulePhase,
): number {
  const total = Number(session.items_answered ?? 0);
  if (phase === 'LOWER') {
    return total;
  }
  const lowerTarget = moduleItemTarget('LOWER');
  return Math.max(0, total - lowerTarget);
}

export async function startListeningSession(
  admin: SupabaseClient,
  studentId: string,
): Promise<{ sessionId: string; step: ListeningStepPayload }> {
  const { data: session, error } = await admin
    .from('listening_practice_sessions')
    .insert({
      student_id: studentId,
      mode: 'PLACEMENT',
      module_phase: 'LOWER',
      status: 'active',
    })
    .select('*')
    .single();
  if (error) throw error;

  const step = await advanceListeningSession(admin, studentId, session.id as string);
  return { sessionId: session.id as string, step };
}

async function selectNextStimulus(
  admin: SupabaseClient,
  session: Record<string, unknown>,
): Promise<StimulusCandidate | null> {
  const phase = session.module_phase as ListeningModulePhase;
  const usedIds = (session.used_stimulus_ids ?? []) as string[];
  const candidates = await loadStimulusCandidates(admin);
  if (candidates.length === 0) return null;

  const moduleAnswered =
    phase === 'LOWER'
      ? Number(session.items_answered ?? 0)
      : countModuleItemsAnswered(session, phase);
  const taskType = pickTaskTypeForSlot(phase, moduleAnswered);
  const range = difficultyRangeForSession(
    phase,
    session.upper_routing_band != null ? Number(session.upper_routing_band) : null,
  );

  return pickStimulus(candidates, usedIds, taskType, range.min, range.max);
}

export async function acknowledgeStimulusPlayback(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
): Promise<ListeningStepPayload> {
  const session = await loadActiveSession(admin, studentId, sessionId);
  if (!session.awaiting_playback || !session.current_stimulus_id) {
    throw new Error('not_awaiting_playback');
  }

  await admin
    .from('listening_practice_sessions')
    .update({
      awaiting_playback: false,
      current_question_index: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  return getQuestionStep(admin, sessionId, studentId);
}

async function loadActiveSession(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
): Promise<Record<string, unknown>> {
  const { data: session } = await admin
    .from('listening_practice_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (!session || session.status !== 'active') throw new Error('invalid_session');
  return session;
}

async function getQuestionStep(
  admin: SupabaseClient,
  sessionId: string,
  studentId: string,
): Promise<ListeningStepPayload> {
  const session = await loadActiveSession(admin, studentId, sessionId);
  const stimulusId = session.current_stimulus_id as string;
  if (!stimulusId) throw new Error('no_active_stimulus');

  const questions = await loadQuestionsForStimulus(admin, stimulusId);
  const idx = Number(session.current_question_index ?? 0);
  if (idx >= questions.length) throw new Error('stimulus_questions_complete');

  const q = questions[idx]!;
  const { data: stimulus } = await admin
    .from('listening_stimuli')
    .select('task_type')
    .eq('id', stimulusId)
    .single();

  const taskType = (stimulus?.task_type ?? 'CONVERSATION') as ListeningTaskType;
  const phase = session.module_phase as ListeningModulePhase;
  const target = moduleItemTarget(phase);
  const moduleAnswered =
    phase === 'LOWER'
      ? Number(session.items_answered ?? 0)
      : countModuleItemsAnswered(session, phase);

  const showQuestionText = taskType !== 'CHOOSE_RESPONSE';

  return {
    kind: 'QUESTION',
    stimulusId,
    questionId: q.id,
    taskType,
    questionNumber: Number(session.items_answered ?? 0) + 1,
    questionIndexInStimulus: idx,
    questionsInStimulus: questions.length,
    questionText: showQuestionText ? q.question_text : null,
    showQuestionText,
    skill: q.skill,
    difficulty: q.difficulty,
    options: [
      { key: 'A', text: q.option_a },
      { key: 'B', text: q.option_b },
      { key: 'C', text: q.option_c },
      { key: 'D', text: q.option_d },
    ],
    modulePhase: phase,
    moduleProgress: { answered: moduleAnswered, target },
  };
}

export async function advanceListeningSession(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
): Promise<ListeningStepPayload> {
  const session = await loadActiveSession(admin, studentId, sessionId);

  if (session.awaiting_playback && session.current_stimulus_id) {
    return buildStimulusPayloadFromId(
      admin,
      session.current_stimulus_id as string,
      session.module_phase as ListeningModulePhase,
    );
  }

  if (session.current_stimulus_id && !session.awaiting_playback) {
    const questions = await loadQuestionsForStimulus(
      admin,
      session.current_stimulus_id as string,
    );
    const idx = Number(session.current_question_index ?? 0);
    if (idx < questions.length) {
      return getQuestionStep(admin, sessionId, studentId);
    }
  }

  const phase = session.module_phase as ListeningModulePhase;
  const moduleAnswered =
    phase === 'LOWER'
      ? Number(session.items_answered ?? 0)
      : countModuleItemsAnswered(session, phase);
  const target = moduleItemTarget(phase);

  if (moduleAnswered >= target) {
    if (phase === 'LOWER') {
      return beginUpperModule(admin, studentId, sessionId, session);
    }
    return finishListeningSession(admin, studentId, sessionId);
  }

  const next = await selectNextStimulus(admin, session);
  if (!next) throw new Error('no_listening_content');

  const usedIds = [...((session.used_stimulus_ids ?? []) as string[]), next.id];
  const questions = await loadQuestionsForStimulus(admin, next.id);

  await admin
    .from('listening_practice_sessions')
    .update({
      current_stimulus_id: next.id,
      awaiting_playback: true,
      current_question_index: 0,
      used_stimulus_ids: usedIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  return buildStimulusPayload(admin, next, questions.length, phase);
}

async function buildStimulusPayloadFromId(
  admin: SupabaseClient,
  stimulusId: string,
  modulePhase: ListeningModulePhase,
): Promise<ListeningStepPayload> {
  const { data: s } = await admin.from('listening_stimuli').select('*').eq('id', stimulusId).single();
  if (!s) throw new Error('stimulus_not_found');
  const questions = await loadQuestionsForStimulus(admin, stimulusId);
  const stimulus: StimulusCandidate = {
    ...(s as StimulusCandidate),
    speaker_portraits: (s.speaker_portraits ?? []) as SpeakerPortrait[],
    overall_difficulty: Number(s.overall_difficulty),
    questionCount: questions.length,
  };
  return buildStimulusPayload(admin, stimulus, questions.length, modulePhase);
}

async function beginUpperModule(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
  session: Record<string, unknown>,
): Promise<ListeningStepPayload> {
  const { data: lowerAttempts } = await admin
    .from('listening_attempts')
    .select('correct')
    .eq('session_id', sessionId)
    .eq('module_phase', 'LOWER');

  const lowerList = lowerAttempts ?? [];
  const lowerScore =
    lowerList.length > 0
      ? (lowerList.filter((a) => a.correct).length / lowerList.length) * 100
      : 0;
  const band = routeUpperBand(lowerScore);

  await admin
    .from('listening_practice_sessions')
    .update({
      module_phase: 'UPPER',
      lower_module_score: Math.round(lowerScore * 10) / 10,
      upper_routing_band: band,
      current_stimulus_id: null,
      awaiting_playback: false,
      current_question_index: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  return {
    kind: 'MODULE_TRANSITION',
    fromPhase: 'LOWER',
    toPhase: 'UPPER',
    lowerScorePercent: Math.round(lowerScore),
    routingBand: band,
    message:
      band === 3
        ? 'Strong lower module — upper module will use more challenging listening.'
        : band === 2
          ? 'Upper module continues at a moderate challenge level.'
          : 'Upper module will start with more accessible listening tasks.',
  };
}

export async function submitListeningAnswer(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
  questionId: string,
  answer: string,
  responseTimeMs?: number,
): Promise<{ correct: boolean }> {
  const session = await loadActiveSession(admin, studentId, sessionId);
  if (session.awaiting_playback) throw new Error('complete_audio_first');

  const { data: q } = await admin
    .from('listening_questions')
    .select('*')
    .eq('id', questionId)
    .single();
  if (!q) throw new Error('question_not_found');

  const { data: stimulusRow } = await admin
    .from('listening_stimuli')
    .select('task_type')
    .eq('id', q.stimulus_id)
    .single();

  const correct = checkMcqAnswer(answer, q.correct_option as string);
  const phase = session.module_phase as ListeningModulePhase;

  await admin.from('listening_attempts').insert({
    student_id: studentId,
    session_id: sessionId,
    stimulus_id: q.stimulus_id,
    question_id: questionId,
    module_phase: phase,
    task_type: (stimulusRow?.task_type ?? 'CONVERSATION') as ListeningTaskType,
    skill: q.skill,
    difficulty: q.difficulty,
    answer: answer.toUpperCase(),
    correct,
    response_time_ms: responseTimeMs ?? null,
  });

  const nextIndex = Number(session.current_question_index ?? 0) + 1;
  const questions = await loadQuestionsForStimulus(admin, q.stimulus_id as string);
  const stimulusComplete = nextIndex >= questions.length;

  const itemsAnswered = Number(session.items_answered ?? 0) + 1;
  const itemsCorrect = Number(session.items_correct ?? 0) + (correct ? 1 : 0);

  await admin
    .from('listening_practice_sessions')
    .update({
      items_answered: itemsAnswered,
      items_correct: itemsCorrect,
      current_question_index: nextIndex,
      ...(stimulusComplete
        ? {
            current_stimulus_id: null,
            awaiting_playback: false,
            current_question_index: 0,
          }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  return { correct };
}

export async function finishListeningSession(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
) {
  const session = await loadActiveSession(admin, studentId, sessionId);
  const completedAt = new Date().toISOString();
  const summary = await buildListeningSessionSummary(admin, sessionId, {
    ...session,
    completed_at: completedAt,
  });

  await admin
    .from('listening_practice_sessions')
    .update({
      status: 'completed',
      module_phase: 'COMPLETED',
      completed_at: completedAt,
      estimated_cefr: summary.estimatedCefr,
      results_report: summary,
    })
    .eq('id', sessionId);

  await admin.from('listening_practice_profiles').upsert(
    {
      student_id: studentId,
      estimated_cefr: summary.estimatedCefr,
      total_attempts: summary.itemsAnswered,
      total_correct: summary.itemsCorrect,
      overall_accuracy: summary.accuracyPercent,
      highest_difficulty: Math.max(
        ...summary.checklist.map((c) => c.difficulty),
        1,
      ),
      last_practice_at: completedAt,
      updated_at: completedAt,
    },
    { onConflict: 'student_id' },
  );

  return { kind: 'COMPLETE' as const, sessionId, summary };
}
