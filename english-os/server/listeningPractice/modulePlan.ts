import type { ListeningModulePhase, ListeningTaskType } from './types.js';

/** Approximate lower-module item count (calibrate later). */
export const LOWER_MODULE_ITEM_TARGET = 12;

/** Approximate upper-module item count (calibrate later). */
export const UPPER_MODULE_ITEM_TARGET = 18;

/** Task mix weights for lower module (Khawaja routing — not ETS psychometrics). */
export const LOWER_TASK_MIX: Record<ListeningTaskType, number> = {
  CHOOSE_RESPONSE: 0.35,
  CONVERSATION: 0.25,
  ANNOUNCEMENT: 0.2,
  ACADEMIC_TALK: 0.2,
};

/** Upper module emphasizes longer stimuli. */
export const UPPER_TASK_MIX: Record<ListeningTaskType, number> = {
  CHOOSE_RESPONSE: 0.15,
  CONVERSATION: 0.3,
  ANNOUNCEMENT: 0.2,
  ACADEMIC_TALK: 0.35,
};

export function moduleItemTarget(phase: ListeningModulePhase): number {
  if (phase === 'LOWER') return LOWER_MODULE_ITEM_TARGET;
  if (phase === 'UPPER') return UPPER_MODULE_ITEM_TARGET;
  return 0;
}

/** Route upper module difficulty band from lower-module performance (1=easier upper, 3=harder upper). */
export function routeUpperBand(lowerCorrectPercent: number): 1 | 2 | 3 {
  if (lowerCorrectPercent >= 68) return 3;
  if (lowerCorrectPercent >= 45) return 2;
  return 1;
}

export function difficultyRangeForUpperBand(band: 1 | 2 | 3): { min: number; max: number } {
  switch (band) {
    case 1:
      return { min: 2, max: 5 };
    case 2:
      return { min: 4, max: 7 };
    case 3:
      return { min: 6, max: 10 };
  }
}

export function difficultyRangeForLowerModule(): { min: number; max: number } {
  return { min: 2, max: 6 };
}

export function pickTaskTypeForSlot(
  phase: ListeningModulePhase,
  slotIndex: number,
): ListeningTaskType {
  const mix = phase === 'LOWER' ? LOWER_TASK_MIX : UPPER_TASK_MIX;
  const types = Object.keys(mix) as ListeningTaskType[];
  const weights = types.map((t) => mix[t]);
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = (slotIndex * 0.37) % 1;
  for (let i = 0; i < types.length; i++) {
    cursor -= weights[i]! / total;
    if (cursor <= 0) return types[i]!;
  }
  return types[types.length - 1]!;
}
