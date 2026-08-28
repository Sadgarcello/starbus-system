import { supabase } from '@/lib/supabase';
import type { AiTextEvaluation, AiTextSourceType } from '@/types';

export type AiEvaluateResult = AiTextEvaluation & { cached?: boolean };

async function getAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  let accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    accessToken = refreshed.session?.access_token;
    if (!accessToken) {
      throw new Error(
        refreshError?.message || sessionError?.message || 'Not signed in — sign out and sign in again.',
      );
    }
  }

  return accessToken;
}

export const aiCoachService = {
  async getEvaluation(
    sourceType: AiTextSourceType,
    sourceId: string,
  ): Promise<AiTextEvaluation | null> {
    const { data, error } = await supabase
      .from('ai_text_evaluations')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .maybeSingle();

    if (error) {
      if (error.message.includes('ai_text_evaluations') || error.code === '42P01') {
        return null;
      }
      throw error;
    }

    if (!data) return null;
    return data as AiTextEvaluation;
  },

  async evaluateText(input: {
    sourceType: AiTextSourceType;
    sourceId: string;
    force?: boolean;
  }): Promise<AiEvaluateResult> {
    const accessToken = await getAccessToken();

    const res = await fetch('/api/evaluate-text', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        source_type: input.sourceType,
        source_id: input.sourceId,
        force: input.force ?? false,
      }),
    });

    const body = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const detail = body.detail ? ` ${String(body.detail)}` : '';
      throw new Error(`${String(body.error ?? 'AI evaluation failed')}${detail}`);
    }

    return body as unknown as AiEvaluateResult;
  },
};
