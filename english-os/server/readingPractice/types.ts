import type { SectionMeta } from './sectionPlan.js';

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

export type { SectionMeta };

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
  /** Daily Life shared notice/email/menu */
  contextId?: string;
  /** Order within context (0-based, by created_at) */
  questionOrder?: number;
}

/** Student-facing payload — never includes answer keys */
export interface StudentQuestionPayload {
  questionType: ReadingQuestionType;
  questionId: string;
  skill: ReadingSkill | null;
  difficulty: number;
  /** Complete words — full passage with auto-masked blanks */
  displaySentence?: string;
  displayPassage?: string;
  blanks?: { id: number; visiblePrefix: string; maskedDisplay: string }[];
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
  contextId?: string;
  questionsInContext?: number;
  sectionMeta?: SectionMeta;
  placementMeta?: {
    questionNumber: number;
    totalQuestions: number;
    sessionDifficulty: number;
    poolLabel: string;
  };
}

export type WordGradeResult = 'correct' | 'misspelling' | 'incorrect' | 'blank';

export type WordErrorType =
  | 'EXACT'
  | 'ACCEPTED_VARIANT'
  | 'MINOR_SPELLING'
  | 'MODERATE_SPELLING'
  | 'MAJOR_RECOGNIZABLE_SPELLING'
  | 'WORD_FORM_OR_WORD_FAMILY'
  | 'WRONG_WORD'
  | 'NONSENSE'
  | 'MISSING';

export type ChecklistResult = WordGradeResult | 'correct' | 'incorrect';

export interface WordResultDetail {
  targetWord: string;
  studentAnswer: string;
  correctAnswer: string;
  wordScore: number;
  errorType: WordErrorType;
  feedback?: string;
}

export interface MissedWordReport {
  word: string;
  submitted: string | null;
  result?: WordGradeResult;
  itemNumber?: number;
  wordScore?: number;
  errorType?: WordErrorType;
}

export interface ResultChecklistItem {
  number: number;
  questionType: ReadingQuestionType;
  sectionLabel: string;
  yourAnswer: string;
  correctAnswer: string;
  result: ChecklistResult;
  points: number;
  maxPoints: number;
  difficulty?: number;
  passageIndex?: number;
  passageScore?: number;
  words?: WordResultDetail[];
  sessionDifficultyBefore?: number;
  sessionDifficultyAfter?: number;
  classification?: string;
}

export interface SessionHistoryEntry {
  sessionId: string;
  completedAt: string;
  mode: ReadingPracticeMode;
  studentLevel: string;
  practiceDifficulty: number;
  totalPoints: number;
  maxPoints: number;
  accuracyPercent: number;
  fullMarks: number;
  itemCount: number;
}

export interface SessionResultsSummary {
  sessionId: string;
  completedAt: string;
  mode: ReadingPracticeMode;
  studentLevel: string;
  practiceDifficulty: number;
  questions: number;
  correct: number;
  accuracy: number;
  startingDifficulty: number;
  endingDifficulty: number;
  totalPoints: number;
  maxPoints: number;
  accuracyPercent: number;
  fullMarks: number;
  itemCount: number;
  checklist: ResultChecklistItem[];
  strongestSkill: string | null;
  weakestSkill: string | null;
  byType: Record<ReadingQuestionType, { total: number; correct: number; accuracy: number }>;
  missedWords: MissedWordReport[];
  history: SessionHistoryEntry[];
  placement?: {
    estimatedLevel: CefrLevel;
    difficultyReached: number;
    weightedPerformance: number;
    passageScore: string;
    overallScoreOutOf10: number;
    overallScoreOutOf100: number;
  };
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
