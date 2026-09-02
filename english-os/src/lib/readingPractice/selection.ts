import type {
  QuestionCandidate,
  ReadingPracticeMode,
  ReadingPracticeProfile,
  ReadingQuestionType,
  ReadingSkill,
} from './types';
import { TASK_DISTRIBUTION } from './types';
import { difficultyForType } from './difficulty';

export interface SelectionContext {
  mode: ReadingPracticeMode;
  profile: ReadingPracticeProfile;
  recentQuestionIds: string[];
  /** Never repeat these within the current session */
  sessionQuestionIds: string[];
  candidates: QuestionCandidate[];
  /** If academic session has active passage, prefer its remaining questions */
  activePassageId?: string | null;
}

export interface ScoredCandidate extends QuestionCandidate {
  score: number;
}

const SKILL_FIELD: Record<ReadingSkill, keyof ReadingPracticeProfile> = {
  VOCABULARY: 'vocabulary_score',
  SPELLING: 'spelling_score',
  MAIN_IDEA: 'main_idea_score',
  DETAIL: 'detail_score',
  INFERENCE: 'inference_score',
  VOCABULARY_CONTEXT: 'vocabulary_context_score',
  PURPOSE: 'purpose_score',
  REFERENCE: 'detail_score',
  RELATIONSHIP: 'inference_score',
};

export function pickTaskType(
  mode: ReadingPracticeMode,
  profile: ReadingPracticeProfile,
): ReadingQuestionType {
  if (mode === 'COMPLETE_WORDS') return 'COMPLETE_WORDS';
  if (mode === 'DAILY_LIFE') return 'DAILY_LIFE';
  if (mode === 'ACADEMIC') return 'ACADEMIC';

  // Adaptive — weight by weakness (lower skill score = higher weight)
  const types: ReadingQuestionType[] = ['COMPLETE_WORDS', 'DAILY_LIFE', 'ACADEMIC'];
  const weights = types.map((t) => {
    const base = TASK_DISTRIBUTION[t];
    const diff = difficultyForType(profile, t);
    const weakness = (10 - diff) / 10;
    return base + weakness * 0.15;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < types.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return types[i]!;
  }
  return 'ACADEMIC';
}

export function scoreCandidate(
  c: QuestionCandidate,
  ctx: SelectionContext,
): number {
  const targetDiff = difficultyForType(ctx.profile, c.questionType);
  const diffDelta = Math.abs(c.difficulty - targetDiff);
  const difficultyMatch = Math.max(0, 30 - diffDelta * 6);

  let skillNeed = 12;
  if (c.skill) {
    const field = SKILL_FIELD[c.skill];
    const skillScore = ctx.profile[field] as number;
    skillNeed = Math.max(0, 25 - skillScore / 4);
  }

  const weakness = c.skill
    ? Math.max(0, 20 - (ctx.profile[SKILL_FIELD[c.skill]] as number) / 5)
    : 10;

  const cefrMatch = cefrProximity(ctx.profile, c.cefrLevel) * 10;
  const freshness =
    ctx.sessionQuestionIds.includes(c.questionId) || ctx.recentQuestionIds.includes(c.questionId) ? 0 : 10;

  let spaced = 5;
  if (ctx.recentQuestionIds.slice(0, 3).includes(c.questionId)) {
    spaced = 0;
  }

  return difficultyMatch + skillNeed + weakness + cefrMatch + freshness + spaced;
}

function cefrProximity(_profile: ReadingPracticeProfile, _cefr: string): number {
  // Official CEFR is starting point; practice diff already adapts
  return 0.8;
}

export function selectQuestion(ctx: SelectionContext): QuestionCandidate | null {
  const exclude = new Set([...ctx.recentQuestionIds, ...ctx.sessionQuestionIds]);
  let pool = ctx.candidates.filter((c) => !exclude.has(c.questionId));

  if (ctx.activePassageId) {
    const passageQs = pool.filter((c) => c.passageId === ctx.activePassageId);
    if (passageQs.length > 0) pool = passageQs;
  }

  if (pool.length === 0) {
    pool = ctx.candidates.filter((c) => !ctx.sessionQuestionIds.includes(c.questionId));
  }

  if (pool.length === 0) return null;

  const targetType =
    ctx.mode === 'ADAPTIVE' ? pickTaskType(ctx.mode, ctx.profile) : pickTaskType(ctx.mode, ctx.profile);

  const typed = pool.filter((c) => c.questionType === targetType);
  const searchPool = typed.length > 0 ? typed : pool;

  const scored: ScoredCandidate[] = searchPool.map((c) => ({
    ...c,
    score: scoreCandidate(c, ctx),
  }));

  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;

  const top = scored[0]!.score;
  const tier = scored.filter((s) => s.score >= top - 2);
  return tier[Math.floor(Math.random() * tier.length)] ?? scored[0]!;
}

export function summarizeSkills(
  attempts: { skill: ReadingSkill | null; correct: boolean }[],
): { strongest: string | null; weakest: string | null } {
  const map = new Map<string, { total: number; correct: number }>();
  for (const a of attempts) {
    if (!a.skill) continue;
    const cur = map.get(a.skill) ?? { total: 0, correct: 0 };
    cur.total++;
    if (a.correct) cur.correct++;
    map.set(a.skill, cur);
  }
  if (map.size === 0) return { strongest: null, weakest: null };

  let strongest: string | null = null;
  let weakest: string | null = null;
  let bestAcc = -1;
  let worstAcc = 2;

  for (const [skill, { total, correct }] of map) {
    const acc = correct / total;
    if (acc > bestAcc) {
      bestAcc = acc;
      strongest = skill;
    }
    if (acc < worstAcc) {
      worstAcc = acc;
      weakest = skill;
    }
  }
  return { strongest, weakest };
}
