import type { ReadingPracticeMode, ReadingQuestionType } from './types.js';
import { TASK_DISTRIBUTION } from './types.js';

export const SECTION_ORDER: ReadingQuestionType[] = ['COMPLETE_WORDS', 'DAILY_LIFE', 'ACADEMIC'];

export const SECTION_LABELS: Record<ReadingQuestionType, string> = {
  COMPLETE_WORDS: 'Complete the Words',
  DAILY_LIFE: 'Read in Daily Life',
  ACADEMIC: 'Read an Academic Passage',
};

export interface SectionMeta {
  sectionType: ReadingQuestionType;
  sectionLabel: string;
  sectionIndex: number;
  totalSections: number;
  questionInSection: number;
  questionsInSection: number;
  overallQuestion: number;
  totalQuestions: number;
  /** True when this is the first question of a section after section 1 */
  sectionTransition: boolean;
}

export function sectionQuotasForLength(total: number): Record<ReadingQuestionType, number> {
  if (total <= 0) {
    return { COMPLETE_WORDS: 0, DAILY_LIFE: 0, ACADEMIC: 0 };
  }
  if (total === 1) {
    return { COMPLETE_WORDS: 1, DAILY_LIFE: 0, ACADEMIC: 0 };
  }
  if (total === 2) {
    return { COMPLETE_WORDS: 1, DAILY_LIFE: 1, ACADEMIC: 0 };
  }

  let cw = Math.max(1, Math.round(total * TASK_DISTRIBUTION.COMPLETE_WORDS));
  let dl = Math.max(1, Math.round(total * TASK_DISTRIBUTION.DAILY_LIFE));
  let ac = total - cw - dl;

  while (ac < 1 && (cw > 1 || dl > 1)) {
    if (cw >= dl && cw > 1) cw--;
    else if (dl > 1) dl--;
    else break;
    ac = total - cw - dl;
  }

  if (ac < 1) {
    cw = 1;
    dl = 1;
    ac = Math.max(1, total - 2);
  }

  return { COMPLETE_WORDS: cw, DAILY_LIFE: dl, ACADEMIC: ac };
}

export function sectionTypeForQuestionIndex(
  index: number,
  quotas: Record<ReadingQuestionType, number>,
): ReadingQuestionType {
  if (index < quotas.COMPLETE_WORDS) return 'COMPLETE_WORDS';
  if (index < quotas.COMPLETE_WORDS + quotas.DAILY_LIFE) return 'DAILY_LIFE';
  return 'ACADEMIC';
}

export function buildSectionMeta(
  mode: ReadingPracticeMode,
  targetLength: number,
  questionIndex: number,
): SectionMeta | undefined {
  if (mode !== 'ADAPTIVE') return undefined;

  const quotas = sectionQuotasForLength(targetLength);
  const sectionType = sectionTypeForQuestionIndex(questionIndex, quotas);
  const sectionIndex = SECTION_ORDER.indexOf(sectionType) + 1;

  let startIndex = 0;
  for (const type of SECTION_ORDER) {
    if (type === sectionType) break;
    startIndex += quotas[type];
  }

  const questionInSection = questionIndex - startIndex + 1;
  const questionsInSection = quotas[sectionType];

  return {
    sectionType,
    sectionLabel: SECTION_LABELS[sectionType],
    sectionIndex,
    totalSections: SECTION_ORDER.length,
    questionInSection,
    questionsInSection,
    overallQuestion: questionIndex + 1,
    totalQuestions: targetLength,
    sectionTransition: questionInSection === 1 && questionIndex > 0,
  };
}
