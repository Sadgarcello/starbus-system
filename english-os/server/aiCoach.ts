import { z } from 'zod';

/** Static fallbacks if models.list fails. */
export const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash-lite',
] as const;

export const GEMINI_MODEL = GEMINI_MODELS[0];

const cefrSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export type AiCoachResponse = {
  overall_score: number;
  estimated_cefr: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  corrections: Array<{ original: string; correction: string; explanation: string }>;
  coach_note: string;
};

export interface StudentCoachContext {
  name: string;
  level: string;
  examTrack?: string | null;
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

let cachedModelIds: string[] | null = null;
let cacheExpiresAt = 0;
const MODEL_CACHE_MS = 10 * 60 * 1000;

function scoreModelPreference(name: string): number {
  if (name.includes('flash-latest')) return 100;
  if (name.includes('3.6-flash')) return 95;
  if (name.includes('3.5-flash-lite')) return 92;
  if (name.includes('3.7-flash')) return 90;
  if (name.includes('2.5-flash')) return 85;
  if (name.includes('flash-lite')) return 75;
  if (name.includes('flash') && !name.includes('thinking')) return 80;
  if (name.includes('pro-latest')) return 60;
  if (name.includes('pro')) return 50;
  return 10;
}

function isUsableModel(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes('embedding')) return false;
  if (lower.includes('imagen')) return false;
  if (lower.includes('aqa')) return false;
  if (lower.includes('tts')) return false;
  if (lower.includes('robotics')) return false;
  if (lower.includes('thinking')) return false;
  return true;
}

export async function discoverGeminiModels(apiKey: string): Promise<string[]> {
  if (cachedModelIds && Date.now() < cacheExpiresAt) {
    return cachedModelIds;
  }

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',
      { headers: { 'x-goog-api-key': apiKey } },
    );

    if (!res.ok) {
      return [...GEMINI_MODELS];
    }

    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };

    const discovered = (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter((name) => name.length > 0 && isUsableModel(name))
      .sort((a, b) => scoreModelPreference(b) - scoreModelPreference(a));

    if (discovered.length > 0) {
      cachedModelIds = discovered;
      cacheExpiresAt = Date.now() + MODEL_CACHE_MS;
      return discovered;
    }
  } catch {
    /* fall through */
  }

  return [...GEMINI_MODELS];
}

function buildCombinedPrompt(input: EvaluateTextInput): string {
  const recent =
    input.student.recentEvaluations.length > 0
      ? input.student.recentEvaluations
          .map(
            (e, i) =>
              `  ${i + 1}. score ${e.overall_score}/10, CEFR ~${e.estimated_cefr}`,
          )
          .join('\n')
      : '  (none yet)';

  const hobbies =
    input.student.hobbies.length > 0
      ? input.student.hobbies.join(', ')
      : '(none listed)';

  const track = input.student.examTrack?.toLowerCase();
  const examStyle =
    track === 'toefl'
      ? 'Student prepares for TOEFL iBT. Mention integrated/independent writing or lecture-style listening where relevant. Still give CEFR estimate — not an official TOEFL score.'
      : track === 'ielts'
        ? 'Student prepares for IELTS. Mention Task 1/2 writing or Parts 1–3 speaking style where relevant. Still give CEFR estimate — not an official IELTS band score.'
        : track === 'linguaskill'
          ? 'Student prepares for Linguaskill. Mention workplace/business communication and concise professional English where relevant. Still give CEFR estimate — not an official Linguaskill score.'
          : 'General English practice — not an official exam score.';

  return `You are Khawaja AI, a friendly English coach for Khawaja Club.

Give SHORT practice feedback (${examStyle})
Return ONLY a JSON object — no markdown, no extra text.

TASK TYPE: ${input.sourceType}
EXAM TRACK: ${track ?? 'not set'}
TASK CONTEXT:
${input.taskContext}

STUDENT: ${input.student.name}, level ${input.student.level}, interests: ${hobbies}
RECENT SCORES:
${recent}

STUDENT TEXT:
"""
${input.studentText}
"""

JSON shape (follow exactly):
{
  "overall_score": 7,
  "estimated_cefr": "B1",
  "summary": "1-2 sentences",
  "strengths": ["point 1", "point 2"],
  "improvements": ["point 1", "point 2"],
  "corrections": [{"original":"wrong phrase","correction":"fixed phrase","explanation":"why"}],
  "coach_note": "one warm friendly line, optional light joke using their interests"
}

Rules: overall_score integer 0-10; estimated_cefr one of A1,A2,B1,B2,C1,C2; corrections max 5 (use [] if none).`;
}

function extractJsonBlob(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function parseScore(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(10, Math.round(value)));
  }
  const s = String(value ?? '').trim();
  const m = s.match(/(\d+)/);
  if (m) return Math.max(0, Math.min(10, parseInt(m[1]!, 10)));
  return 6;
}

function parseCefr(value: unknown): z.infer<typeof cefrSchema> {
  const raw = String(value ?? 'B1').trim().toUpperCase();
  const token = raw.split(/[/,\s]/)[0] ?? 'B1';
  const parsed = cefrSchema.safeParse(token);
  return parsed.success ? parsed.data : 'B1';
}

function parseStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((v) => String(v).trim()).filter(Boolean);
  return items.length > 0 ? items.slice(0, 4) : fallback;
}

function parseCorrections(value: unknown): AiCoachResponse['corrections'] {
  if (!Array.isArray(value)) return [];
  const out: AiCoachResponse['corrections'] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const original = String(o.original ?? '').trim();
    const correction = String(o.correction ?? '').trim();
    const explanation = String(o.explanation ?? '').trim();
    if (original && correction) {
      out.push({
        original,
        correction,
        explanation: explanation || 'See the corrected form.',
      });
    }
    if (out.length >= 5) break;
  }
  return out;
}

function parseAiResponse(rawJson: string): AiCoachResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonBlob(rawJson));
  } catch {
    throw new Error('invalid_json');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('invalid_json');
  }

  const o = parsed as Record<string, unknown>;

  return {
    overall_score: parseScore(o.overall_score),
    estimated_cefr: parseCefr(o.estimated_cefr),
    summary: String(o.summary ?? 'Good effort — keep practicing.').trim().slice(0, 600),
    strengths: parseStringArray(o.strengths, ['You expressed your ideas clearly.']),
    improvements: parseStringArray(o.improvements, ['Keep building vocabulary and grammar.']),
    corrections: parseCorrections(o.corrections),
    coach_note: String(
      o.coach_note ?? 'Nice work — Khawaja AI is cheering you on!',
    )
      .trim()
      .slice(0, 400),
  };
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  prompt: string,
  jsonMode: boolean,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.35,
      maxOutputTokens: 1024,
    };
    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });

    const rawBody = await res.text();

    if (!res.ok) {
      throw new Error(`gemini_http_${res.status}: ${rawBody.slice(0, 280)}`);
    }

    let data: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
    };
    try {
      data = JSON.parse(rawBody) as typeof data;
    } catch {
      throw new Error('gemini_bad_response');
    }

    if (data.promptFeedback?.blockReason) {
      throw new Error(`gemini_blocked: ${data.promptFeedback.blockReason}`);
    }

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('').trim();

    if (!text) {
      const finish = candidate?.finishReason ?? 'unknown';
      throw new Error(`gemini_empty_response: ${finish}`);
    }

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

function shouldTryNextModel(message: string): boolean {
  return (
    message.includes('404') ||
    message.includes('NOT_FOUND') ||
    message.includes('no longer available') ||
    message.startsWith('gemini_empty_response') ||
    message.includes('blockReason') ||
    message.startsWith('gemini_blocked') ||
    message.includes('responseMimeType') ||
    message.includes('JSON mode is not')
  );
}

export function humanizeGeminiError(message: string): string {
  if (message.includes('API_KEY_INVALID') || message.includes('gemini_http_400')) {
    return 'Gemini rejected the request. Check GEMINI_API_KEY on Vercel.';
  }
  if (message.includes('gemini_http_403') || message.includes('PERMISSION_DENIED')) {
    return 'Gemini access denied for this API key.';
  }
  if (message.includes('no_models_available')) {
    return 'No working Gemini model found. Try again later or contact admin.';
  }
  if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
    return 'Khawaja AI is busy — wait a minute and try again.';
  }
  if (message.includes('gemini_timeout')) {
    return 'AI took too long — please try again.';
  }
  if (message.includes('invalid_json')) {
    return 'AI returned unreadable text — tap Re-check.';
  }
  if (message.startsWith('gemini_empty_response') || message.startsWith('gemini_blocked')) {
    return 'AI could not process this text — try shortening it or tap Re-check.';
  }
  if (message.includes('gemini_http_404') || message.includes('NOT_FOUND')) {
    return 'AI model unavailable — admin will update the model list.';
  }
  return `Could not evaluate your text. (${message.slice(0, 80)})`;
}

export async function evaluateStudentText(
  apiKey: string,
  input: EvaluateTextInput,
): Promise<AiCoachResponse & { modelUsed: string }> {
  const prompt = buildCombinedPrompt(input);

  const envModel = process.env.GEMINI_MODEL?.trim();
  const discovered = await discoverGeminiModels(apiKey);
  const modelsToTry = [
    ...(envModel ? [envModel] : []),
    ...discovered,
    ...GEMINI_MODELS,
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const errors: string[] = [];

  for (const model of modelsToTry) {
    for (const jsonMode of [false, true]) {
      try {
        const raw = await callGeminiModel(apiKey, model, prompt, jsonMode);
        const parsed = parseAiResponse(raw);
        return { ...parsed, modelUsed: model };
      } catch (e) {
        const msg = (e as Error).message ?? 'unknown';
        errors.push(`${model}${jsonMode ? '+json' : ''}: ${msg.slice(0, 60)}`);
        if (shouldTryNextModel(msg)) continue;
        if (msg === 'invalid_json') continue;
        if (msg.includes('gemini_http_403') || msg.includes('API_KEY_INVALID')) {
          throw e;
        }
        continue;
      }
    }
  }

  throw new Error(`no_models_available: ${errors.slice(0, 4).join(' | ')}`);
}

export function getGeminiApiKey(): string | null {
  let key = process.env.GEMINI_API_KEY?.trim() ?? '';
  // Vercel CLI sometimes stores empty keys as literal `""`
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (key.length < 20) {
    return null;
  }
  return key;
}
