import type { CefrLevel } from './types';
import { CEFR_STARTING_DIFFICULTY, RECENT_WINDOW } from './types';

export function clampDifficulty(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value * 10) / 10));
}

export function cefrToStartingDifficulty(level: string | null | undefined): number {
  const key = (level?.toUpperCase() ?? 'A1') as CefrLevel;
  return CEFR_STARTING_DIFFICULTY[key] ?? 4;
}

export function adjustDifficulty(current: number, recentCorrect: boolean[]): number {
  if (recentCorrect.length === 0) return clampDifficulty(current);

  const window = recentCorrect.slice(-RECENT_WINDOW);
  const accuracy = window.filter(Boolean).length / window.length;

  let delta = 0;
  if (accuracy >= 0.9) delta = 0.4;
  else if (accuracy >= 0.8) delta = 0.2;
  else if (accuracy >= 0.7) delta = 0;
  else if (accuracy >= 0.6) delta = -0.2;
  else delta = -0.4;

  return clampDifficulty(current + delta);
}

export function difficultyForType(
  profile: {
    overall_reading_difficulty: number;
    complete_words_difficulty: number;
    daily_life_difficulty: number;
    academic_difficulty: number;
  },
  type: 'COMPLETE_WORDS' | 'DAILY_LIFE' | 'ACADEMIC',
): number {
  switch (type) {
    case 'COMPLETE_WORDS':
      return clampDifficulty(profile.complete_words_difficulty);
    case 'DAILY_LIFE':
      return clampDifficulty(profile.daily_life_difficulty);
    case 'ACADEMIC':
      return clampDifficulty(profile.academic_difficulty);
    default:
      return clampDifficulty(profile.overall_reading_difficulty);
  }
}

export function updateSkillScore(current: number, correct: boolean): number {
  const delta = correct ? 2 : -3;
  return Math.min(100, Math.max(0, Math.round((current + delta) * 10) / 10));
}

export function updateMastery(current: number, correct: boolean): number {
  const delta = correct ? 8 : -12;
  return Math.min(100, Math.max(0, current + delta));
}
