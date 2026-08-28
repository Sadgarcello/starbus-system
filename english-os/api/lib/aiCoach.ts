import { z } from 'zod';

export const GEMINI_MODEL = 'gemini-2.0-flash';

const cefrSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const correctionSchema = z.object({
  original: z.string().min(1),
  correction: z.string().min(1),
  explanation: z.string().min(1),
});

export const aiCoachResponseSchema = z.object({
  overall_score: z.number().int().min(0).max(10),
  estimated_cefr: cefrSchema,
  summary: z.string().min(1).max(600),
  strengths: z.array(z.string()).min(1).max(4),
  improvements: z.array(z.string()).min(1).max(4),
  corrections: z.array(correctionSchema).max(5),
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
- corrections: list the most important mistakes only (max 5).
- coach_note: one casual, warm line — you may include a light, school-appropriate joke referencing the student's name or interests when natural. Never mock, insult, or be sarcastic in a hurtful way.
- Be encouraging. Compare gently to their recent scores when provided.
- estimated_cefr is an approximate level only (A1–C2).`;
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
  "overall_score": 0-10 integer,
  "estimated_cefr": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
  "summary": "1-2 sentences",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "corrections": [{"original":"...","correction":"...","explanation":"..."}],
  "coach_note": "friendly personalized line, optional light joke"
}`;
}

function normalizeResponse(raw: AiCoachResponse): AiCoachResponse {
  return {
    ...raw,
    corrections: raw.corrections.slice(0, 5),
    strengths: raw.strengths.slice(0, 4),
    improvements: raw.improvements.slice(0, 4),
  };
}

async function callGemini(apiKey: string, systemText: string, userText: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
      throw new Error(`gemini_http_${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('gemini_empty_response');
    return text;
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
  return normalizeResponse(aiCoachResponseSchema.parse(parsed));
}

export async function evaluateStudentText(
  apiKey: string,
  input: EvaluateTextInput,
): Promise<AiCoachResponse> {
  const systemText = buildSystemPrompt();
  const userText = buildUserPrompt(input);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const retryNote =
        attempt === 1
          ? '\n\nIMPORTANT: Your previous reply was invalid. Return ONLY valid JSON matching the schema.'
          : '';
      const raw = await callGemini(apiKey, systemText, userText + retryNote);
      return parseAndValidate(raw);
    } catch (e) {
      lastError = e as Error;
      if ((e as Error).message === 'invalid_json' || (e as Error).name === 'ZodError') {
        continue;
      }
      throw e;
    }
  }

  throw lastError ?? new Error('evaluation_failed');
}

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}
