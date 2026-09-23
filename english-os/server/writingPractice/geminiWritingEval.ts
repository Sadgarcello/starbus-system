import { createHash } from 'node:crypto';
import { getGeminiApiKey, GEMINI_MODELS } from '../aiCoach.js';
import type { ErrorSeverity, TargetedExercise, WritingErrorItem } from './types.js';

export interface ExtendedWritingInput {
  taskType: 'EMAIL' | 'ACADEMIC_DISCUSSION';
  taskPrompt: string;
  studentText: string;
  recurringSummary: string;
}

export interface GeminiWritingAnalysis {
  taskScore0to5: number;
  taskScorePercent: number;
  dimensionScores: Record<string, number>;
  requirementStatus?: Record<string, 'completed' | 'partial' | 'missing'>;
  errors: WritingErrorItem[];
  strengths: string[];
  topPriorities: string[];
  secondaryIssues: string[];
  exercises: TargetedExercise[];
}

export interface CombinedGeminiResult {
  email: GeminiWritingAnalysis;
  discussion: GeminiWritingAnalysis;
  modelUsed: string;
  inputHash: string;
}

export function hashWritingInputs(email: string, discussion: string): string {
  return createHash('sha256').update(`${email}\n---\n${discussion}`).digest('hex');
}

const SYSTEM_RULES = `You are Khawaja Club TOEFL Writing diagnostic evaluator.
Evaluate ONLY the supplied student text and task. Return JSON only.
Distinguish definite ERRORS from STYLE preferences. Do not invent student intent.
For each error include exact student_text substring and start_offset/end_offset (0-based, end exclusive).
Categories include: GRAMMAR, WORD_FORM, COLLOCATION, VOCABULARY_RANGE, VOCABULARY_ACCURACY, PUNCTUATION, CAPITALIZATION, REGISTER, DEVELOPMENT, ORGANIZATION, COHESION, CLARITY, REPETITION, TASK_COMPLETION, RELEVANCE, SENTENCE_STRUCTURE, SENTENCE_VARIETY, SPELLING.
Severity: CRITICAL, MAJOR, MODERATE, MINOR.
Provide targeted_exercise for top errors (MCQ or fill).
Do not rewrite the entire response.`;

function buildPrompt(input: ExtendedWritingInput): string {
  return `${SYSTEM_RULES}

TASK TYPE: ${input.taskType}
TASK:
${input.taskPrompt}

STUDENT RECURRING PATTERNS (context only):
${input.recurringSummary || 'None yet.'}

STUDENT RESPONSE:
"""
${input.studentText}
"""

Return JSON:
{
  "taskScore0to5": number,
  "dimensionScores": { "TASK_COMPLETION": 0-100, ... },
  "requirementStatus": { "requirement_1": "completed|partial|missing" } (email only),
  "errors": [{ "student_text","start_offset","end_offset","error_type","severity","what_is_wrong","correction","why","what_to_do","targeted_exercise":{...} }],
  "strengths": ["..."],
  "topPriorities": ["..."],
  "secondaryIssues": ["..."],
  "exercises": [{ "prompt","format","options","correct_answer","explanation" }]
}`;
}

async function callGeminiJson(prompt: string): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('gemini_missing_key');

  const model = GEMINI_MODELS[0]!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`gemini_http_${res.status}: ${raw.slice(0, 200)}`);
  const data = JSON.parse(raw) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!text) throw new Error('gemini_empty_response');
  return text;
}

function parseAnalysis(raw: string, studentText: string): GeminiWritingAnalysis {
  const o = JSON.parse(raw) as Record<string, unknown>;
  const taskScore0to5 = Math.min(5, Math.max(0, Number(o.taskScore0to5 ?? 3)));
  const taskScorePercent = Math.round((taskScore0to5 / 5) * 100);
  const dimensionScores = (o.dimensionScores as Record<string, number>) ?? {};
  const errors = parseErrors(o.errors, studentText);
  return {
    taskScore0to5,
    taskScorePercent,
    dimensionScores,
    requirementStatus: o.requirementStatus as Record<string, 'completed' | 'partial' | 'missing'> | undefined,
    errors,
    strengths: stringArray(o.strengths),
    topPriorities: stringArray(o.topPriorities),
    secondaryIssues: stringArray(o.secondaryIssues),
    exercises: parseExercises(o.exercises),
  };
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean).slice(0, 8);
}

function parseErrors(v: unknown, fullText: string): WritingErrorItem[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).map((item) => {
    const e = item as Record<string, unknown>;
    let start = Number(e.start_offset ?? 0);
    let end = Number(e.end_offset ?? 0);
    const student_text = String(e.student_text ?? '');
    if (student_text && fullText.includes(student_text)) {
      const idx = fullText.indexOf(student_text);
      if (idx >= 0) {
        start = idx;
        end = idx + student_text.length;
      }
    }
    return {
      student_text,
      start_offset: start,
      end_offset: end,
      error_type: String(e.error_type ?? 'GRAMMAR'),
      severity: (String(e.severity ?? 'MODERATE').toUpperCase() as ErrorSeverity) || 'MODERATE',
      what_is_wrong: String(e.what_is_wrong ?? ''),
      correction: String(e.correction ?? ''),
      why: String(e.why ?? e.what_is_wrong ?? ''),
      what_to_do: String(e.what_to_do ?? ''),
      targeted_exercise: e.targeted_exercise as TargetedExercise | undefined,
    };
  });
}

function parseExercises(v: unknown): TargetedExercise[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 12).map((item) => {
    const e = item as Record<string, unknown>;
    return {
      prompt: String(e.prompt ?? ''),
      format: (e.format as TargetedExercise['format']) ?? 'mcq',
      options: Array.isArray(e.options) ? e.options.map(String) : undefined,
      correct_answer: String(e.correct_answer ?? ''),
      explanation: String(e.explanation ?? ''),
    };
  });
}

export async function analyzeExtendedWritingPair(input: {
  email: ExtendedWritingInput;
  discussion: ExtendedWritingInput;
}): Promise<CombinedGeminiResult> {
  const inputHash = hashWritingInputs(input.email.studentText, input.discussion.studentText);
  const [emailRaw, discussionRaw] = await Promise.all([
    callGeminiJson(buildPrompt(input.email)),
    callGeminiJson(buildPrompt(input.discussion)),
  ]);
  return {
    email: parseAnalysis(emailRaw, input.email.studentText),
    discussion: parseAnalysis(discussionRaw, input.discussion.studentText),
    modelUsed: GEMINI_MODELS[0]!,
    inputHash,
  };
}
