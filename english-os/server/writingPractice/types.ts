export type BuildSentenceErrorCategory =
  | 'WORD_ORDER'
  | 'SUBJECT_VERB_AGREEMENT'
  | 'TENSE'
  | 'AUXILIARY'
  | 'NEGATION'
  | 'QUESTION_FORMATION'
  | 'ARTICLE'
  | 'PREPOSITION'
  | 'SINGULAR_PLURAL'
  | 'PRONOUN'
  | 'MODIFIER_POSITION'
  | 'CLAUSE_STRUCTURE'
  | 'CONNECTOR'
  | 'FRAGMENT'
  | 'EXTRA_WORD'
  | 'MISSING_WORD'
  | 'OTHER';

export type ErrorSeverity = 'CRITICAL' | 'MAJOR' | 'MODERATE' | 'MINOR';

export interface BuildSentenceGradeResult {
  correct: boolean;
  scorePercent: number;
  studentSentence: string;
  expectedSentence: string;
  normalizedStudent: string[];
  normalizedExpected: string[];
  missingWords: string[];
  extraWords: string[];
  misplacedWords: string[];
  issueCategory: BuildSentenceErrorCategory | null;
  issueLabel: string | null;
  whatToDo: string | null;
}

export interface WritingErrorItem {
  student_text: string;
  start_offset: number;
  end_offset: number;
  error_type: string;
  severity: ErrorSeverity;
  what_is_wrong: string;
  correction: string;
  why: string;
  what_to_do: string;
  targeted_exercise?: TargetedExercise;
}

export interface TargetedExercise {
  prompt: string;
  format: 'mcq' | 'fill' | 'correct_sentence' | 'free';
  options?: string[];
  correct_answer: string;
  explanation: string;
}

export interface WritingQuotaInfo {
  testsRemaining: number;
  maxTestsPerWindow: number;
  windowHours: number;
  nextAvailableAt: string | null;
  blocked: boolean;
}

export interface DiagnosticReport {
  sessionId: string;
  diagnosticScore: number;
  estimatedCefr: string;
  buildSentencePercent: number;
  emailPercent: number;
  discussionPercent: number;
  languageProfile: Record<string, number>;
  writingSkills: Record<string, number>;
  topWeaknesses: string[];
  strengths: string[];
  buildSentenceItems: BuildSentenceGradeResult[];
  errors: WritingErrorItem[];
  aiStatus: 'pending' | 'processing' | 'complete' | 'failed';
  aiMessage?: string;
  recurringHighlights: { category: string; totalCount: number }[];
  emailResponse?: string;
  discussionResponse?: string;
}
