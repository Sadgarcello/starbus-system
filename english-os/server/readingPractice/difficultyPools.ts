import type { CefrLevel, QuestionCandidate } from './types.js';

export const PLACEMENT_SESSION_LENGTH = 10;
export const PLACEMENT_START_DIFFICULTY = 1;

export interface DifficultyPool {
  pool: number;
  min: number;
  max: number;
  label: string;
}

export const DIFFICULTY_POOLS: DifficultyPool[] = [
  { pool: 1, min: 1, max: 3, label: '1–3' },
  { pool: 2, min: 3, max: 5, label: '3–5' },
  { pool: 3, min: 5, max: 6, label: '5–6' },
  { pool: 4, min: 6, max: 7, label: '6–7' },
  { pool: 5, min: 7, max: 8, label: '7–8' },
  { pool: 6, min: 8, max: 10, label: '8–10' },
];

/** Integer session difficulty clamped to 1–10 */
export function clampSessionDifficulty(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

/** @deprecated Use clampSessionDifficulty for placement — kept for non-placement decimal profiles */
export function clampDifficulty(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value * 10) / 10));
}

export function poolForDifficulty(difficulty: number): DifficultyPool {
  const d = clampSessionDifficulty(difficulty);
  for (const pool of DIFFICULTY_POOLS) {
    if (d >= pool.min && d <= pool.max) return pool;
  }
  return d <= 3 ? DIFFICULTY_POOLS[0]! : DIFFICULTY_POOLS[DIFFICULTY_POOLS.length - 1]!;
}

export function difficultyInPool(difficulty: number, pool: DifficultyPool): boolean {
  const d = Number(difficulty);
  return d >= pool.min && d <= pool.max;
}

export function pickRandomCandidate(candidates: QuestionCandidate[]): QuestionCandidate | null {
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

/** @deprecated Legacy binary helper — not used for placement */
export function adjustSessionDifficulty(current: number, correct: boolean): number {
  const step = correct ? 1 : 1;
  return clampSessionDifficulty(current + (correct ? step : -step));
}

/**
 * Integer adaptive step after each passage.
 * passageScorePercent is 0–100 (average word score for the passage).
 */
export function adjustSessionDifficultyFromPassageScore(
  sessionDifficulty: number,
  passageScorePercent: number,
): number {
  const current = clampSessionDifficulty(sessionDifficulty);

  if (passageScorePercent >= 85) {
    return clampSessionDifficulty(current + 1);
  }
  if (passageScorePercent >= 50) {
    return current;
  }
  return clampSessionDifficulty(current - 1);
}

export interface PlacementAttempt {
  passageScore: number;
  difficulty: number;
}

export interface PlacementEstimate {
  estimatedLevel: CefrLevel;
  difficultyReached: number;
  weightedPerformance: number;
}

/**
 * Estimates CEFR proficiency from adaptive trajectory — separate from diagnostic %.
 * Uses difficulty served, performance at upper boundary, and consistency.
 */
export function estimateProficiency(attempts: PlacementAttempt[]): PlacementEstimate {
  if (attempts.length === 0) {
    return { estimatedLevel: 'A1', difficultyReached: 1, weightedPerformance: 0 };
  }

  const difficultyReached = Math.max(...attempts.map((a) => a.difficulty));

  let weightedSuccess = 0;
  let totalWeight = 0;
  for (const a of attempts) {
    const w = Math.max(1, a.difficulty);
    totalWeight += w;
    weightedSuccess += w * (a.passageScore / 100);
  }
  const weightedPerformance = totalWeight > 0 ? weightedSuccess / totalWeight : 0;

  const avgPassageScore =
    attempts.reduce((s, a) => s + a.passageScore, 0) / attempts.length;

  const upperAttempts = attempts.filter((a) => a.difficulty >= difficultyReached - 1);
  const upperAvg =
    upperAttempts.length > 0
      ? upperAttempts.reduce((s, a) => s + a.passageScore, 0) / upperAttempts.length
      : avgPassageScore;

  const highAttempts = attempts.filter((a) => a.difficulty >= 7);
  const highAvg =
    highAttempts.length > 0
      ? highAttempts.reduce((s, a) => s + a.passageScore, 0) / highAttempts.length
      : null;

  let estimatedLevel: CefrLevel;

  if (
    difficultyReached >= 8 &&
    weightedPerformance >= 0.72 &&
    upperAvg >= 70 &&
    avgPassageScore >= 68
  ) {
    estimatedLevel = 'C1';
  } else if (
    difficultyReached >= 6 &&
    (weightedPerformance >= 0.58 || avgPassageScore >= 62)
  ) {
    estimatedLevel = 'B2';
  } else if (
    difficultyReached >= 4 &&
    (weightedPerformance >= 0.45 || avgPassageScore >= 50)
  ) {
    estimatedLevel = 'B1';
  } else if (difficultyReached >= 2 || avgPassageScore >= 35) {
    estimatedLevel = 'A2';
  } else {
    estimatedLevel = 'A1';
  }

  if (highAvg != null && highAttempts.length >= 2 && highAvg < 40) {
    if (estimatedLevel === 'C1') estimatedLevel = 'B2';
    else if (estimatedLevel === 'B2') estimatedLevel = 'B1';
  }

  if (upperAvg < 45 && difficultyReached >= 7 && estimatedLevel !== 'A1') {
    const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const idx = levels.indexOf(estimatedLevel);
    if (idx > 0) estimatedLevel = levels[idx - 1]!;
  }

  return {
    estimatedLevel,
    difficultyReached,
    weightedPerformance: Math.round(weightedPerformance * 1000) / 1000,
  };
}

function sortByDifficultyDistance(
  candidates: QuestionCandidate[],
  targetDifficulty: number,
): QuestionCandidate[] {
  return [...candidates].sort((a, b) => {
    const da = Math.abs(a.difficulty - targetDifficulty);
    const db = Math.abs(b.difficulty - targetDifficulty);
    if (da !== db) return da - db;
    return a.difficulty - b.difficulty;
  });
}

export function selectCompleteWordsByPool(
  candidates: QuestionCandidate[],
  sessionDifficulty: number,
  sessionQuestionIds: string[],
  recentQuestionIds: string[],
): QuestionCandidate | null {
  const targetDifficulty = clampSessionDifficulty(sessionDifficulty);
  const exclude = new Set([...sessionQuestionIds, ...recentQuestionIds]);
  let pool = poolForDifficulty(targetDifficulty);
  let cw = candidates.filter(
    (c) => c.questionType === 'COMPLETE_WORDS' && !exclude.has(c.questionId),
  );

  if (cw.length === 0) {
    cw = candidates.filter(
      (c) => c.questionType === 'COMPLETE_WORDS' && !sessionQuestionIds.includes(c.questionId),
    );
  }
  if (cw.length === 0) return null;

  const pickFromPool = (p: DifficultyPool) =>
    cw.filter((c) => difficultyInPool(c.difficulty, p));

  let poolCandidates = pickFromPool(pool);

  if (poolCandidates.length === 0) {
    const idx = DIFFICULTY_POOLS.findIndex((p) => p.pool === pool.pool);
    for (const offset of [1, -1, 2, -2, 3]) {
      const neighbor = DIFFICULTY_POOLS[idx + offset];
      if (!neighbor) continue;
      poolCandidates = pickFromPool(neighbor);
      if (poolCandidates.length > 0) {
        pool = neighbor;
        break;
      }
    }
  }

  if (poolCandidates.length === 0) poolCandidates = cw;

  const exactMatches = poolCandidates.filter((c) => c.difficulty === targetDifficulty);
  if (exactMatches.length > 0) {
    return pickRandomCandidate(exactMatches);
  }

  const sorted = sortByDifficultyDistance(poolCandidates, targetDifficulty);
  const closestDistance = Math.abs(sorted[0]!.difficulty - targetDifficulty);
  const closest = sorted.filter(
    (c) => Math.abs(c.difficulty - targetDifficulty) === closestDistance,
  );
  return pickRandomCandidate(closest);
}
