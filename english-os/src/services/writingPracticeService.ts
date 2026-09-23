import { getValidAccessToken } from '@/lib/accessToken';
import type { DiagnosticReport, StudentWritingItemPayload, WritingQuotaInfo } from '@/lib/writingPractice/types';

async function authHeaders(forceRefresh = false): Promise<HeadersInit> {
  const token = await getValidAccessToken(forceRefresh);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function post(body: Record<string, unknown>): Promise<Response> {
  const payload = JSON.stringify(body);
  let res = await fetch('/api/writing-practice', { method: 'POST', headers: await authHeaders(), body: payload });
  if (res.status === 401) {
    res = await fetch('/api/writing-practice', {
      method: 'POST',
      headers: await authHeaders(true),
      body: payload,
    });
  }
  return res;
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 120) || `Request failed (${res.status})`);
  }
}

export const writingPracticeService = {
  async quota(): Promise<WritingQuotaInfo> {
    const res = await post({ action: 'quota' });
    const json = await parse<{ quota?: WritingQuotaInfo; error?: string; message?: string }>(res);
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'quota_failed');
    return json.quota!;
  },

  async start(): Promise<{ sessionId: string; quota: WritingQuotaInfo; item: StudentWritingItemPayload }> {
    const res = await post({ action: 'start' });
    const json = await parse<{
      sessionId?: string;
      quota?: WritingQuotaInfo;
      item?: StudentWritingItemPayload;
      error?: string;
      message?: string;
    }>(res);
    if (res.status === 429) {
      throw new Error(json.message ?? 'Writing test limit reached for the last 48 hours.');
    }
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'start_failed');
    if (!json.sessionId || !json.item) throw new Error('Invalid API response');
    return { sessionId: json.sessionId, quota: json.quota!, item: json.item };
  },

  async saveDraft(sessionId: string, itemIndex: number, responseText: string): Promise<void> {
    const res = await post({ action: 'saveDraft', sessionId, itemIndex, responseText });
    if (!res.ok) {
      const json = await parse<{ message?: string }>(res);
      throw new Error(json.message ?? 'save_failed');
    }
  },

  async submitItem(
    sessionId: string,
    itemIndex: number,
    responseText: string,
  ): Promise<{ item: StudentWritingItemPayload | null; finished: boolean }> {
    const res = await post({ action: 'submitItem', sessionId, itemIndex, responseText });
    const json = await parse<{
      item?: StudentWritingItemPayload | null;
      finished?: boolean;
      message?: string;
      error?: string;
    }>(res);
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'submit_failed');
    return { item: json.item ?? null, finished: Boolean(json.finished) };
  },

  async finish(sessionId: string): Promise<DiagnosticReport> {
    const res = await post({ action: 'finish', sessionId });
    const json = await parse<{ report?: DiagnosticReport; message?: string; error?: string }>(res);
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'finish_failed');
    if (!json.report) throw new Error('Invalid API response');
    return json.report;
  },

  async report(sessionId: string): Promise<DiagnosticReport> {
    const res = await post({ action: 'report', sessionId });
    const json = await parse<{ report?: DiagnosticReport; error?: string }>(res);
    if (!res.ok) throw new Error(json.error ?? 'report_failed');
    if (!json.report) throw new Error('Report not found');
    return json.report;
  },
};
