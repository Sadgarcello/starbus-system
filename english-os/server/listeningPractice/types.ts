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

export type ListeningPracticeMode = 'PLACEMENT' | 'PRACTICE';

export type ListeningStepKind = 'STIMULUS' | 'QUESTION' | 'MODULE_TRANSITION' | 'COMPLETE';

export interface SpeakerPortrait {
  name: string;
  role: string;
  imagePath?: string;
}

export interface ListeningStimulusRow {
  id: string;
  task_type: ListeningTaskType;
  title: string;
  audio_path: string;
  duration_seconds: number | null;
  transcript: string | null;
  accent: string | null;
  academic_field: string | null;
  cefr_level: string;
  overall_difficulty: number;
  speaker_portraits: SpeakerPortrait[];
  context_tags: string[];
  active: boolean;
}

export interface ListeningQuestionRow {
  id: string;
  stimulus_id: string;
  question_text: string;
  skill: ListeningSkill;
  difficulty: number;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string | null;
  order_index: number;
  active: boolean;
}

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
