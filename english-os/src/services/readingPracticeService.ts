import { supabase } from '@/lib/supabase';
import type {
  ReadingPracticeMode,
  ReadingQuestionType,
  SessionResultsSummary,
  StudentQuestionPayload,
} from '@/lib/readingPractice/types';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim();
    if (res.status === 404 || snippet.startsWith('<!')) {
      throw new Error(
        'Reading practice API is unavailable. If testing locally, run `npx vercel dev` (Vite alone does not serve /api routes).',
      );
    }
    if (snippet.toLowerCase().includes('server') && snippet.toLowerCase().includes('error')) {
      throw new Error(
        'Reading practice server error. Confirm migrations 0021 and 0022 ran in Supabase, then redeploy.',
      );
    }
    throw new Error(snippet || `Request failed (${res.status})`);
  }
}

export const readingPracticeService = {
  async start(mode: ReadingPracticeMode, length = 10): Promise<{ sessionId: string; question: StudentQuestionPayload }> {
    const res = await fetch('/api/reading-practice', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ action: 'start', mode, length }),
    });
    const json = await parseApiResponse<{ sessionId?: string; question?: StudentQuestionPayload; error?: string; message?: string }>(res);
    if (!res.ok) {
      if (json.error === 'toefl_only') {
        throw new Error(json.message ?? 'Set your exam track to TOEFL in Settings.');
      }
      if (json.error === 'no_questions') {
        throw new Error(json.message ?? 'no_questions');
      }
      if (json.error === 'migration_required') {
        throw new Error(json.message ?? 'migration_required');
      }
      throw new Error(json.message ?? json.error ?? 'start_failed');
    }
    if (!json.sessionId || !json.question) {
      throw new Error('Invalid response from reading practice API');
    }
    return { sessionId: json.sessionId, question: json.question };
  },

  async next(sessionId: string): Promise<StudentQuestionPayload> {
    const res = await fetch('/api/reading-practice', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ action: 'next', sessionId }),
    });
    const json = await parseApiResponse<{ question?: StudentQuestionPayload; error?: string; message?: string }>(res);
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'next_failed');
    if (!json.question) throw new Error('Invalid response from reading practice API');
    return json.question;
  },

  async submit(
    sessionId: string,
    questionId: string,
    questionType: ReadingQuestionType,
    answer: string,
    responseTimeMs?: number,
  ): Promise<{ correct: boolean; explanation: string | null; reveal?: string }> {
    const res = await fetch('/api/reading-practice', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        action: 'submit',
        sessionId,
        questionId,
        questionType,
        answer,
        responseTimeMs,
      }),
    });
    const json = await parseApiResponse<{ correct: boolean; explanation: string | null; reveal?: string; error?: string; message?: string }>(res);
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'submit_failed');
    return json;
  },

  async finish(sessionId: string): Promise<SessionResultsSummary> {
    const res = await fetch('/api/reading-practice', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ action: 'finish', sessionId }),
    });
    const json = await parseApiResponse<{ summary?: SessionResultsSummary; error?: string; message?: string }>(res);
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'finish_failed');
    if (!json.summary) throw new Error('Invalid response from reading practice API');
    return json.summary;
  },
};
