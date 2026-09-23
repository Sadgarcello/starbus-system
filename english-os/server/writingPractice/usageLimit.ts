import type { SupabaseClient } from '@supabase/supabase-js';
import type { WritingQuotaInfo } from './types.js';

export const MAX_WRITING_TESTS_PER_WINDOW = 2;
export const WRITING_WINDOW_MS = 48 * 60 * 60 * 1000;

export async function getWritingQuota(
  admin: SupabaseClient,
  studentId: string,
): Promise<WritingQuotaInfo> {
  const since = new Date(Date.now() - WRITING_WINDOW_MS).toISOString();
  const { data } = await admin
    .from('writing_test_completions')
    .select('completed_at')
    .eq('student_id', studentId)
    .gte('completed_at', since)
    .order('completed_at', { ascending: true });

  const completions = (data ?? []).map((r) => new Date(r.completed_at as string).getTime());
  const used = completions.length;
  const remaining = Math.max(0, MAX_WRITING_TESTS_PER_WINDOW - used);

  let nextAvailableAt: string | null = null;
  if (remaining === 0 && completions.length > 0) {
    const oldest = completions[0]!;
    nextAvailableAt = new Date(oldest + WRITING_WINDOW_MS).toISOString();
  }

  return {
    testsRemaining: remaining,
    maxTestsPerWindow: MAX_WRITING_TESTS_PER_WINDOW,
    windowHours: 48,
    nextAvailableAt,
    blocked: remaining <= 0,
  };
}

export async function assertCanStartWritingTest(
  admin: SupabaseClient,
  studentId: string,
): Promise<WritingQuotaInfo> {
  const quota = await getWritingQuota(admin, studentId);
  if (quota.blocked) {
    const err = new Error('writing_quota_exceeded');
    (err as Error & { quota: WritingQuotaInfo }).quota = quota;
    throw err;
  }
  return quota;
}
