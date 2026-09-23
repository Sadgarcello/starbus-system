import type { CefrLevel } from '../readingPractice/types.js';

export function estimateListeningCefr(input: {
  accuracyPercent: number;
  maxDifficultyServed: number;
  upperBand: number | null;
}): CefrLevel {
  const { accuracyPercent, maxDifficultyServed } = input;

  if (maxDifficultyServed >= 8 && accuracyPercent >= 72) return 'C1';
  if (maxDifficultyServed >= 6 && accuracyPercent >= 58) return 'B2';
  if (maxDifficultyServed >= 4 && accuracyPercent >= 45) return 'B1';
  if (maxDifficultyServed >= 2 || accuracyPercent >= 32) return 'A2';
  return 'A1';
}
