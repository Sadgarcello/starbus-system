import type { ReadingPracticeMode, ReadingQuestionType } from './types';

import { TASK_DISTRIBUTION } from './types';



export const SECTION_ORDER: ReadingQuestionType[] = ['COMPLETE_WORDS', 'DAILY_LIFE', 'ACADEMIC'];



export const SECTION_LABELS: Record<ReadingQuestionType, string> = {

  COMPLETE_WORDS: 'Complete the Words',

  DAILY_LIFE: 'Read in Daily Life',

  ACADEMIC: 'Read an Academic Passage',

};



/** Complete the Words placement test length (fixed). */

export const MIN_COMPLETE_WORDS_QUESTIONS = 10;

export const COMPLETE_WORDS_PLACEMENT_LENGTH = 10;



export interface SectionMeta {

  sectionType: ReadingQuestionType;

  sectionLabel: string;

  sectionIndex: number;

  totalSections: number;

  questionInSection: number;

  questionsInSection: number;

  overallQuestion: number;

  totalQuestions: number;

  sectionTransition: boolean;

}



export function sectionQuotasForLength(

  total: number,

  mode: ReadingPracticeMode = 'ADAPTIVE',

): Record<ReadingQuestionType, number> {

  if (mode === 'COMPLETE_WORDS') {

    return {

      COMPLETE_WORDS: COMPLETE_WORDS_PLACEMENT_LENGTH,

      DAILY_LIFE: 0,

      ACADEMIC: 0,

    };

  }

  if (mode === 'DAILY_LIFE') {

    return { COMPLETE_WORDS: 0, DAILY_LIFE: Math.max(1, total), ACADEMIC: 0 };

  }

  if (mode === 'ACADEMIC') {

    return { COMPLETE_WORDS: 0, DAILY_LIFE: 0, ACADEMIC: Math.max(1, total) };

  }



  const cw = MIN_COMPLETE_WORDS_QUESTIONS;

  const remaining = Math.max(2, total - cw);

  let dl = Math.max(1, Math.round(remaining * (TASK_DISTRIBUTION.DAILY_LIFE / (TASK_DISTRIBUTION.DAILY_LIFE + TASK_DISTRIBUTION.ACADEMIC))));

  let ac = remaining - dl;

  if (ac < 1) {

    ac = 1;

    dl = Math.max(1, remaining - 1);

  }

  return { COMPLETE_WORDS: cw, DAILY_LIFE: dl, ACADEMIC: ac };

}



export function effectiveSessionLength(

  requested: number,

  mode: ReadingPracticeMode = 'ADAPTIVE',

): number {

  const quotas = sectionQuotasForLength(requested, mode);

  return quotas.COMPLETE_WORDS + quotas.DAILY_LIFE + quotas.ACADEMIC;

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



  const quotas = sectionQuotasForLength(targetLength, mode);

  const effectiveTotal =

    quotas.COMPLETE_WORDS + quotas.DAILY_LIFE + quotas.ACADEMIC;

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

    totalQuestions: effectiveTotal,

    sectionTransition: questionInSection === 1 && questionIndex > 0,

  };

}


