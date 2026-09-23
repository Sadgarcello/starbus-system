export type ListeningTaskType =
  | 'CHOOSE_RESPONSE'
  | 'CONVERSATION'
  | 'ANNOUNCEMENT'
  | 'ACADEMIC_TALK';

export type ListeningSkill =
  | 'APPROPRIATE_RESPONSE'
  | 'MAIN_IDEA'
  | 'DETAIL'
  | 'INFERENCE'
  | 'PURPOSE'
  | 'SPEAKER_INTENT'
  | 'SPEAKER_ATTITUDE'
  | 'ORGANIZATION'
  | 'FUNCTION'
  | 'VOCABULARY_IN_CONTEXT'
  | 'NEXT_ACTION';

export type ListeningModulePhase = 'LOWER' | 'UPPER' | 'COMPLETED';

export interface StimulusPlaybackPayload {
  kind: 'STIMULUS';
  stimulusId: string;
  taskType: ListeningTaskType;
  title: string;
  audioUrl: string;
  durationSeconds: number | null;
  speakers: { name: string; role: string; imageUrl: string | null }[];
  questionCount: number;
  modulePhase: ListeningModulePhase;
  hideSpokenPromptText: boolean;
  notesAllowed: boolean;
}

export interface QuestionStepPayload {
  kind: 'QUESTION';
  stimulusId: string;
  questionId: string;
  taskType: ListeningTaskType;
  questionNumber: number;
  questionIndexInStimulus: number;
  questionsInStimulus: number;
  questionText: string | null;
  showQuestionText: boolean;
  skill: ListeningSkill;
  difficulty: number;
  options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
  modulePhase: ListeningModulePhase;
  moduleProgress: { answered: number; target: number };
}

export interface ModuleTransitionPayload {
  kind: 'MODULE_TRANSITION';
  fromPhase: 'LOWER';
  toPhase: 'UPPER';
  lowerScorePercent: number;
  routingBand: number;
  message: string;
}

export interface SessionCompletePayload {
  kind: 'COMPLETE';
  sessionId: string;
  summary?: ListeningSessionSummary;
}

export type ListeningStepPayload =
  | StimulusPlaybackPayload
  | QuestionStepPayload
  | ModuleTransitionPayload
  | SessionCompletePayload;

export interface ListeningSessionSummary {
  sessionId: string;
  completedAt: string;
  estimatedCefr: string;
  lowerModuleScore: number | null;
  upperRoutingBand: number | null;
  accuracyPercent: number;
  itemsAnswered: number;
  itemsCorrect: number;
  checklist: ListeningResultItem[];
}

export interface ListeningResultItem {
  number: number;
  taskType: ListeningTaskType;
  skill: ListeningSkill;
  difficulty: number;
  correct: boolean;
  yourAnswer: string;
  correctAnswer: string;
  modulePhase: ListeningModulePhase;
}

export const LISTENING_TASK_LABELS: Record<ListeningTaskType, string> = {
  CHOOSE_RESPONSE: 'Listen and Choose a Response',
  CONVERSATION: 'Listen to a Conversation',
  ANNOUNCEMENT: 'Listen to an Announcement',
  ACADEMIC_TALK: 'Listen to an Academic Talk',
};

export const LISTENING_SKILL_LABELS: Record<ListeningSkill, string> = {
  APPROPRIATE_RESPONSE: 'Appropriate response',
  MAIN_IDEA: 'Main idea',
  DETAIL: 'Detail',
  INFERENCE: 'Inference',
  PURPOSE: 'Purpose',
  SPEAKER_INTENT: 'Speaker intent',
  SPEAKER_ATTITUDE: 'Speaker attitude',
  ORGANIZATION: 'Organization',
  FUNCTION: 'Function',
  VOCABULARY_IN_CONTEXT: 'Vocabulary in context',
  NEXT_ACTION: 'Next action',
};
