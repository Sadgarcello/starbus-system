import { z } from 'zod';

/** Models to try in order (free-tier friendly). */
export const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
] as const;

export const GEMINI_MODEL = GEMINI_MODELS[0];

const cefrSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const correctionSchema = z.object({
  original: z.string().min(1),
  correction: z.string().min(1),
  explanation: z.string().min(1),
});

export const aiCoachResponseSchema = z.object({
  overall_score: z.preprocess(
    (v) => Math.round(Number(v)),
    z.number().int().min(0).max(10),
  ),
  estimated_cefr: z.preprocess((v) => String(v).trim().toUpperCase(), cefrSchema),
  summary: z.string().min(1).max(600),
  strengths: z.array(z.string()).max(4).default([]),
  improvements: z.array(z.string()).max(4).default([]),
  corrections: z.array(correctionSchema).max(5).default([]),
  coach_note: z.string().min(1).max(400),
});

export type AiCoachResponse = z.infer<typeof aiCoachResponseSchema>;

export interface StudentCoachContext {
  name: string;
  level: string;
  hobbies: string[];
  recentEvaluations: Array<{
    overall_score: number;
    estimated_cefr: string;
    coach_note: string;
  }>;
}

export interface EvaluateTextInput {
  sourceType: 'writing' | 'listening';
  taskContext: string;
  studentText: string;
  student: StudentCoachContext;
}

function buildSystemPrompt(): string {
  return `You are Khawaja AI, a friendly English coach for Khawaja Club students.

Rules:
- Give SHORT feedback only (summary max 2 sentences).
- Scores are practice estimates — never claim official TOEFL, IELTS, or exam scores.
- Return valid JSON matching the required schema exactly.
- overall_score must be an integer 0-10.
- estimated_cefr must be exactly one of: A1, A2, B1, B2, C1, C2 (uppercase).
- corrections: list the most important mistakes only (max 5; use [] if none).
- strengths and improvements: at least one item each.
- coach_note: one casual, warm line — you may include a light, school-appropriate joke referencing the student's name or interests when natural. Never mock, insult, or be sarcastic in a hurtful way.
- Be encouraging. Compare gently to their recent scores when provided.`;
}

function buildUserPrompt(input: EvaluateTextInput): string {
  const recent =
    input.student.recentEvaluations.length > 0
      ? input.student.recentEvaluations
          .map(
            (e, i) =>
              `  ${i + 1}. score ${e.overall_score}/10, CEFR ~${e.estimated_cefr}, coach said: "${e.coach_note}"`,
          )
          .join('\n')
      : '  (none yet — first AI check for this student)';

  const hobbies =
    input.student.hobbies.length > 0
      ? input.student.hobbies.join(', ')
      : '(none listed yet)';

  return `TASK TYPE: ${input.sourceType}
TASK CONTEXT:
${input.taskContext}

STUDENT PROFILE:
- Name: ${input.student.name}
- Level: ${input.student.level}
- Interests: ${hobbies}

RECENT AI HISTORY:
${recent}

STUDENT TEXT TO EVALUATE:
"""
${input.studentText}
"""

Respond with JSON only:
{
  "overall_score": 7,
  "estimated_cefr": "B1",
  "summary": "1-2 sentences",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "corrections": [{"original":"...","correction":"...","explanation":"..."}],
  "coach_note": "friendly personalized line"
}`;
}

function normalizeResponse(raw: AiCoachResponse): AiCoachResponse {
  const strengths = raw.strengths.length > 0 ? raw.strengths : ['You communicated a clear idea.'];
  const improvements =
    raw.improvements.length > 0 ? raw.improvements : ['Keep practicing — small steps add up.'];

  return {
    ...raw,
    corrections: raw.corrections.slice(0, 5),
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
  };
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  systemText: string,
  userText: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`gemini_http_${res.status}: ${errBody.slice(0, 240)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('gemini_empty_response');
    return text;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('gemini_timeout');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

function parseAndValidate(rawJson: string): AiCoachResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('invalid_json');
  }
  const result = aiCoachResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`invalid_schema: ${result.error.issues[0]?.message ?? 'bad shape'}`);
  }
  return normalizeResponse(result.data);
}

export function humanizeGeminiError(message: string): string {
  if (message.includes('API_KEY_INVALID') || message.includes('gemini_http_400')) {
    return 'Gemini API key is invalid. Re-enter GEMINI_API_KEY on Vercel and redeploy.';
  }
  if (message.includes('gemini_http_403') || message.includes('PERMISSION_DENIED')) {
    return 'Gemini API access denied. Check your API key at Google AI Studio.';
  }
  if (message.includes('gemini_http_404') || message.includes('NOT_FOUND')) {
    return 'AI model unavailable. Try again in a few minutes.';
  }
  if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
    return 'Khawaja AI is busy — wait a minute and try again.';
  }
  if (message.includes('gemini_timeout')) {
    return 'AI took too long — please try again.';
  }
  if (message.includes('invalid_json') || message.includes('invalid_schema')) {
    return 'AI returned an unexpected format — tap Re-check to try again.';
  }
  return 'Could not evaluate your text. Please try again.';
}

export async function evaluateStudentText(
  apiKey: string,
  input: EvaluateTextInput,
): Promise<AiCoachResponse & { modelUsed: string }> {
  const systemText = buildSystemPrompt();
  const userText = buildUserPrompt(input);

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const retryNote =
          attempt === 1
            ? '\n\nIMPORTANT: Return ONLY valid JSON. overall_score must be integer. estimated_cefr uppercase A1-C2.'
            : '';
        const raw = await callGeminiModel(apiKey, model, systemText, userText + retryNote);
        const parsed = parseAndValidate(raw);
        return { ...parsed, modelUsed: model };
      } catch (e) {
        lastError = e as Error;
        const msg = lastError.message ?? '';
        const retryableParse = msg === 'invalid_json' || msg.startsWith('invalid_schema');
        const modelMissing = msg.includes('404') || msg.includes('NOT_FOUND');
        if (retryableParse) continue;
        if (modelMissing) break;
        throw e;
      }
    }
  }

  throw lastError ?? new Error('evaluation_failed');
}

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}
