import type { UserRole } from '@/types';

function parseBool(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export function isAiCoachStudentAccessEnabled(): boolean {
  return parseBool(import.meta.env.VITE_AI_COACH_STUDENT_ACCESS as string | undefined);
}

export function getAiCoachAllowedUserIds(): Set<string> {
  const raw = (import.meta.env.VITE_AI_COACH_ALLOWED_USER_IDS as string | undefined)?.trim() ?? '';
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function canUseAiCoach(userId: string | undefined, role: UserRole | null): boolean {
  if (!userId) return false;
  if (role === 'admin' || role === 'teacher') return true;
  if (isAiCoachStudentAccessEnabled()) return true;
  return getAiCoachAllowedUserIds().has(userId);
}

export const AI_COACH_LOCKED_MESSAGE =
  'Khawaja AI Coach is not available yet. Your teacher will turn it on when you are ready to use it.';
