export type WritingQuotaInfo = {
  testsRemaining: number;
  maxTestsPerWindow: number;
  windowHours: number;
  nextAvailableAt: string | null;
  blocked: boolean;
};

export type WritingErrorItem = {
  student_text: string;
  start_offset: number;
  end_offset: number;
  error_type: string;
  severity: string;
  what_is_wrong: string;
  correction: string;
  why: string;
  what_to_do: string;
  targeted_exercise?: {
    prompt: string;
    format: string;
    options?: string[];
    correct_answer: string;
    explanation: string;
  };
};

export type DiagnosticReport = {
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
  buildSentenceItems: Array<{
    correct: boolean;
    studentSentence: string;
    expectedSentence: string;
    issueLabel: string | null;
    whatToDo: string | null;
  }>;
  errors: WritingErrorItem[];
  aiStatus: 'pending' | 'processing' | 'complete' | 'failed';
  aiMessage?: string;
  recurringHighlights: { category: string; totalCount: number }[];
  emailResponse?: string;
  discussionResponse?: string;
};

export type StudentWritingItemPayload = {
  itemIndex: number;
  totalItems: number;
  itemType: 'BUILD_SENTENCE' | 'EMAIL' | 'ACADEMIC_DISCUSSION';
  timeLimitSeconds: number;
  buildSentence?: { itemId: string; prompt: string; wordBank: string[] };
  email?: Record<string, unknown>;
  discussion?: Record<string, unknown>;
};
