export type ReadingQuestionType = 'COMPLETE_WORDS' | 'DAILY_LIFE' | 'ACADEMIC';
export type ReadingSkill =
  | 'VOCABULARY'
  | 'SPELLING'
  | 'MAIN_IDEA'
  | 'DETAIL'
  | 'INFERENCE'
  | 'VOCABULARY_CONTEXT'
  | 'PURPOSE'
  | 'REFERENCE'
  | 'RELATIONSHIP';

export type ReadingPracticeMode = 'ADAPTIVE' | 'COMPLETE_WORDS' | 'DAILY_LIFE' | 'ACADEMIC';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface ReadingPracticeProfile {
  student_id: string;
  overall_reading_difficulty: number;
  complete_words_difficulty: number;
  daily_life_difficulty: number;
  academic_difficulty: number;
  vocabulary_score: number;
  spelling_score: number;
  academic_vocabulary_score: number;
  main_idea_score: number;
  detail_score: number;
  inference_score: number;
  vocabulary_context_score: number;
  purpose_score: number;
  total_attempts: number;
  total_correct: number;
  overall_accuracy: number;
  highest_difficulty: number;
  last_practice_at: string | null;
}

export interface CompleteWordsQuestion {
  id: string;
  sentence: string;
  target_word: string;
  cefr_level: string;
  difficulty: number;
  category: string | null;
  explanation: string | null;
  active: boolean;
}

export interface DailyLifeQuestion {
  id: string;
  title: string;
  content: string;
  content_type: string;
  cefr_level: string;
  difficulty: number;
  skill: ReadingSkill;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string | null;
  active: boolean;
}

export interface AcademicPassage {
  id: string;
  title: string;
  passage_text: string;
  cefr_level: string;
  difficulty: number;
  topic: string | null;
  word_count: number | null;
  active: boolean;
}

export interface AcademicQuestion {
  id: string;
  passage_id: string;
  question: string;
  question_type: string;
  skill: ReadingSkill;
  difficulty: number;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string | null;
  active: boolean;
}

export interface ReadingAttemptRow {
  question_id: string;
  question_type: ReadingQuestionType;
  skill: ReadingSkill | null;
  difficulty: number | null;
  correct: boolean;
  attempted_at: string;
}

export interface QuestionCandidate {
  questionId: string;
  questionType: ReadingQuestionType;
  skill: ReadingSkill | null;
  difficulty: number;
  cefrLevel: string;
  passageId?: string;
}

/** Student-facing payload — never includes answer keys */
export interface StudentQuestionPayload {
  questionType: ReadingQuestionType;
  questionId: string;
  skill: ReadingSkill | null;
  difficulty: number;
  /** Complete words */
  displaySentence?: string;
  /** Daily life / academic */
  title?: string;
  content?: string;
  contentType?: string;
  passageText?: string;
  passageId?: string;
  questionText?: string;
  options?: { key: 'A' | 'B' | 'C' | 'D'; label: string }[];
  questionIndex?: number;
  questionsInPassage?: number;
}

export interface SessionResultsSummary {
  questions: number;
  correct: number;
  accuracy: number;
  startingDifficulty: number;
  endingDifficulty: number;
  strongestSkill: string | null;
  weakestSkill: string | null;
  byType: Record<ReadingQuestionType, { total: number; correct: number; accuracy: number }>;
}

export const DEFAULT_SESSION_LENGTH = 10;
export const RECENT_WINDOW = 10;
export const HISTORY_EXCLUDE_COUNT = 10;

export const TASK_DISTRIBUTION: Record<ReadingQuestionType, number> = {
  COMPLETE_WORDS: 0.3,
  DAILY_LIFE: 0.3,
  ACADEMIC: 0.4,
};

export const CEFR_STARTING_DIFFICULTY: Record<CefrLevel, number> = {
  A1: 2,
  A2: 3,
  B1: 4,
  B2: 6,
  C1: 8,
  C2: 9,
};
