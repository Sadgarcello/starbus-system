import { getValidAccessToken } from '@/lib/accessToken';
import type {
  ReadingPracticeMode,
  ReadingQuestionType,
  SessionHistoryEntry,
  SessionResultsSummary,
  StudentQuestionPayload,
} from '@/lib/readingPractice/types';

async function authHeaders(forceRefresh = false): Promise<HeadersInit> {
  const token = await getValidAccessToken(forceRefresh);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function postReadingPractice(body: Record<string, unknown>): Promise<Response> {
  const payload = JSON.stringify(body);
  let res = await fetch('/api/reading-practice', {
    method: 'POST',
    headers: await authHeaders(),
    body: payload,
  });

  if (res.status === 401) {
    res = await fetch('/api/reading-practice', {
      method: 'POST',
      headers: await authHeaders(true),
      body: payload,
    });
  }

  return res;
}

function throwReadingPracticeError(json: { error?: string; message?: string }, fallback: string): never {
  if (json.error === 'unauthorized') {
    throw new Error(
      json.message ??
        'Your session expired during practice. Sign out, sign in again, then restart or continue from Reading Practice.',
    );
  }
  if (json.error === 'toefl_only') {
    throw new Error(json.message ?? 'Set your exam track to TOEFL in Settings.');
  }
  if (json.error === 'students_only') {
    throw new Error(
      json.message ?? 'Reading practice is for student accounts only. Log in as a student, not Club Admin.',
    );
  }
  if (json.error === 'account_not_active') {
    throw new Error(json.message ?? 'Your account is not active yet.');
  }
  if (json.error === 'not_a_student') {
    throw new Error(json.message ?? 'Could not verify your student record on the server.');
  }
  if (
    json.error === 'no_questions' ||
    json.error === 'no_daily_life_questions' ||
    json.error === 'no_academic_questions' ||
    json.error === 'no_eligible_question' ||
    json.error === 'no_eligible_daily_life_question' ||
    json.error === 'no_eligible_academic_question' ||
    json.error === 'wrong_question_type_for_mode'
  ) {
    throw new Error(json.message ?? json.error);
  }
  if (json.error === 'migration_required') {
    throw new Error(json.message ?? 'migration_required');
  }
  if (json.error === 'forbidden') {
    throw new Error(json.message ?? 'You can only view your own reading practice results.');
  }
  if (json.error === 'student_id_required') {
    throw new Error(json.message ?? 'Select a student to view their reading results.');
  }
  if (json.error === 'student_not_found') {
    throw new Error(json.message ?? 'Student not found.');
  }
  if (json.error === 'report_not_found') {
    throw new Error(json.message ?? 'Report not found.');
  }
  throw new Error(json.message ?? json.error ?? fallback);
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim();
    if (res.status === 504 || /gateway timeout/i.test(snippet)) {
      throw new Error(
        'The reading practice server timed out. Wait a moment and tap Retry — if this keeps happening, your Supabase project may be slow or paused.',
      );
    }
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
    if (res.status === 401) {
      throw new Error(
        'Your session expired during practice. Sign out, sign in again, then continue from Reading Practice.',
      );
    }
    throw new Error(snippet || `Request failed (${res.status})`);
  }
}

export const readingPracticeService = {
  async start(mode: ReadingPracticeMode, length = 10): Promise<{ sessionId: string; question: StudentQuestionPayload }> {
    const res = await postReadingPractice({ action: 'start', mode, length });
    const json = await parseApiResponse<{ sessionId?: string; question?: StudentQuestionPayload; error?: string; message?: string }>(res);
    if (!res.ok) throwReadingPracticeError(json, 'start_failed');
    if (!json.sessionId || !json.question) {
      throw new Error('Invalid response from reading practice API');
    }
    return { sessionId: json.sessionId, question: json.question };
  },

  async next(sessionId: string): Promise<StudentQuestionPayload> {
    const res = await postReadingPractice({ action: 'next', sessionId });
    const json = await parseApiResponse<{ question?: StudentQuestionPayload; error?: string; message?: string }>(res);
    if (!res.ok) throwReadingPracticeError(json, 'next_failed');
    if (!json.question) throw new Error('Invalid response from reading practice API');
    return json.question;
  },

  async submit(
    sessionId: string,
    questionId: string,
    questionType: ReadingQuestionType,
    answer: string,
    responseTimeMs?: number,
  ): Promise<{ correct: boolean; explanation: string | null }> {
    const res = await postReadingPractice({
      action: 'submit',
      sessionId,
      questionId,
      questionType,
      answer,
      responseTimeMs,
    });
    const json = await parseApiResponse<{ correct: boolean; explanation: string | null; error?: string; message?: string }>(res);
    if (!res.ok) throwReadingPracticeError(json, 'submit_failed');
    return json;
  },

  async finish(sessionId: string): Promise<SessionResultsSummary> {
    const res = await postReadingPractice({ action: 'finish', sessionId });
    const json = await parseApiResponse<{ summary?: SessionResultsSummary; error?: string; message?: string }>(res);
    if (!res.ok) throwReadingPracticeError(json, 'finish_failed');
    if (!json.summary) throw new Error('Invalid response from reading practice API');
    return json.summary;
  },

  async getReport(sessionId: string, studentId?: string): Promise<SessionResultsSummary> {
    const res = await postReadingPractice({
      action: 'report',
      sessionId,
      ...(studentId ? { studentId } : {}),
    });
    const json = await parseApiResponse<{ summary?: SessionResultsSummary; error?: string; message?: string }>(res);
    if (!res.ok) throwReadingPracticeError(json, 'report_failed');
    if (!json.summary) throw new Error('Invalid response from reading practice API');
    return json.summary;
  },

  async getHistory(options?: {
    studentId?: string;
    mode?: ReadingPracticeMode;
  }): Promise<SessionHistoryEntry[]> {
    const res = await postReadingPractice({
      action: 'history',
      ...(options?.studentId ? { studentId: options.studentId } : {}),
      ...(options?.mode ? { mode: options.mode } : {}),
    });
    const json = await parseApiResponse<{ history?: SessionHistoryEntry[]; error?: string; message?: string }>(res);
    if (!res.ok) throwReadingPracticeError(json, 'history_failed');
    return json.history ?? [];
  },
};
