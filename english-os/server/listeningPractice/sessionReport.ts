import type { SupabaseClient } from '@supabase/supabase-js';
import { estimateListeningCefr } from './cefrEstimate.js';
import type { ListeningResultItem, ListeningSessionSummary } from './types.js';

interface AttemptRow {
  question_id: string;
  stimulus_id: string;
  task_type: string;
  skill: string;
  difficulty: number;
  answer: string;
  correct: boolean;
  module_phase: string;
}

export async function buildListeningSessionSummary(
  admin: SupabaseClient,
  sessionId: string,
  session: Record<string, unknown>,
): Promise<ListeningSessionSummary> {
  const { data: attempts } = await admin
    .from('listening_attempts')
    .select('*')
    .eq('session_id', sessionId)
    .order('attempted_at', { ascending: true });

  const list = (attempts ?? []) as AttemptRow[];
  const checklist: ListeningResultItem[] = [];

  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    const { data: q } = await admin
      .from('listening_questions')
      .select('correct_option')
      .eq('id', a.question_id)
      .single();
    checklist.push({
      number: i + 1,
      taskType: a.task_type as ListeningResultItem['taskType'],
      skill: a.skill as ListeningResultItem['skill'],
      difficulty: Number(a.difficulty),
      correct: a.correct,
      yourAnswer: a.answer,
      correctAnswer: (q?.correct_option as string) ?? '—',
      modulePhase: a.module_phase as ListeningResultItem['modulePhase'],
    });
  }

  const itemsAnswered = list.length;
  const itemsCorrect = list.filter((a) => a.correct).length;
  const accuracyPercent =
    itemsAnswered > 0 ? Math.round((itemsCorrect / itemsAnswered) * 100) : 0;
  const maxDifficulty =
    list.length > 0 ? Math.max(...list.map((a) => Number(a.difficulty))) : 1;

  const estimatedCefr = estimateListeningCefr({
    accuracyPercent,
    maxDifficultyServed: maxDifficulty,
    upperBand: session.upper_routing_band != null ? Number(session.upper_routing_band) : null,
  });

  return {
    sessionId,
    completedAt: (session.completed_at as string) ?? new Date().toISOString(),
    estimatedCefr,
    lowerModuleScore:
      session.lower_module_score != null ? Number(session.lower_module_score) : null,
    upperRoutingBand:
      session.upper_routing_band != null ? Number(session.upper_routing_band) : null,
    accuracyPercent,
    itemsAnswered,
    itemsCorrect,
    checklist,
  };
}
