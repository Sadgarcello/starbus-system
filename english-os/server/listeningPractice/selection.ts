import type { ListeningStimulusRow, ListeningTaskType } from './types.js';

export interface StimulusCandidate extends ListeningStimulusRow {
  questionCount: number;
}

export function pickStimulus(
  candidates: StimulusCandidate[],
  usedIds: string[],
  taskType: ListeningTaskType,
  difficultyMin: number,
  difficultyMax: number,
): StimulusCandidate | null {
  const used = new Set(usedIds);
  let pool = candidates.filter(
    (c) =>
      c.active &&
      c.task_type === taskType &&
      c.overall_difficulty >= difficultyMin &&
      c.overall_difficulty <= difficultyMax &&
      c.questionCount > 0 &&
      !used.has(c.id),
  );

  if (pool.length === 0) {
    pool = candidates.filter(
      (c) =>
        c.active &&
        c.task_type === taskType &&
        c.questionCount > 0 &&
        !used.has(c.id),
    );
  }

  if (pool.length === 0) {
    pool = candidates.filter(
      (c) => c.active && c.questionCount > 0 && !used.has(c.id),
    );
  }

  if (pool.length === 0) return null;

  const targetMid = (difficultyMin + difficultyMax) / 2;
  pool.sort(
    (a, b) =>
      Math.abs(a.overall_difficulty - targetMid) - Math.abs(b.overall_difficulty - targetMid),
  );

  const bestDistance = Math.abs(pool[0]!.overall_difficulty - targetMid);
  const tied = pool.filter(
    (c) => Math.abs(c.overall_difficulty - targetMid) === bestDistance,
  );
  return tied[Math.floor(Math.random() * tied.length)]!;
}
