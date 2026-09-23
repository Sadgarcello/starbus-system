import { getValidAccessToken } from '@/lib/accessToken';
import type { ListeningSessionSummary, ListeningStepPayload } from '@/lib/listeningPractice/types';

async function authHeaders(forceRefresh = false): Promise<HeadersInit> {
  const token = await getValidAccessToken(forceRefresh);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function postListening(body: Record<string, unknown>): Promise<Response> {
  const payload = JSON.stringify(body);
  let res = await fetch('/api/listening-practice', {
    method: 'POST',
    headers: await authHeaders(),
    body: payload,
  });
  if (res.status === 401) {
    res = await fetch('/api/listening-practice', {
      method: 'POST',
      headers: await authHeaders(true),
      body: payload,
    });
  }
  return res;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 120) || `Request failed (${res.status})`);
  }
}

export const listeningPracticeService = {
  async start(): Promise<{ sessionId: string; step: ListeningStepPayload }> {
    const res = await postListening({ action: 'start' });
    const json = await parseJson<{
      sessionId?: string;
      step?: ListeningStepPayload;
      error?: string;
      message?: string;
    }>(res);
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'start_failed');
    if (!json.sessionId || !json.step) throw new Error('Invalid listening API response');
    return { sessionId: json.sessionId, step: json.step };
  },

  async advance(sessionId: string): Promise<ListeningStepPayload> {
    const res = await postListening({ action: 'advance', sessionId });
    const json = await parseJson<{ step?: ListeningStepPayload; error?: string; message?: string }>(
      res,
    );
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'advance_failed');
    if (!json.step) throw new Error('Invalid listening API response');
    return json.step;
  },

  async ackStimulus(sessionId: string): Promise<ListeningStepPayload> {
    const res = await postListening({ action: 'ackStimulus', sessionId });
    const json = await parseJson<{ step?: ListeningStepPayload; error?: string; message?: string }>(
      res,
    );
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'ack_failed');
    if (!json.step) throw new Error('Invalid listening API response');
    return json.step;
  },

  async submit(
    sessionId: string,
    questionId: string,
    answer: string,
    responseTimeMs?: number,
  ): Promise<{ correct: boolean }> {
    const res = await postListening({
      action: 'submit',
      sessionId,
      questionId,
      answer,
      responseTimeMs,
    });
    const json = await parseJson<{ correct?: boolean; error?: string; message?: string }>(res);
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'submit_failed');
    return { correct: Boolean(json.correct) };
  },

  async finish(sessionId: string): Promise<ListeningSessionSummary> {
    const res = await postListening({ action: 'finish', sessionId });
    const json = await parseJson<{
      summary?: ListeningSessionSummary;
      error?: string;
      message?: string;
    }>(res);
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'finish_failed');
    if (!json.summary) throw new Error('Invalid listening API response');
    return json.summary;
  },

  async getReport(sessionId: string): Promise<ListeningSessionSummary> {
    const res = await postListening({ action: 'report', sessionId });
    const json = await parseJson<{ summary?: ListeningSessionSummary; error?: string }>(res);
    if (!res.ok) throw new Error(json.error ?? 'report_failed');
    if (!json.summary) throw new Error('Report not found');
    return json.summary as ListeningSessionSummary;
  },
};
