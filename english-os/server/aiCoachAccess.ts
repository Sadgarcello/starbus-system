/** When true, all students may use Khawaja AI Coach. Default: locked. */
export function isAiCoachStudentAccessEnabled(): boolean {
  const raw = process.env.AI_COACH_STUDENT_ACCESS?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getAiCoachAllowedUserIds(): Set<string> {
  const raw = process.env.AI_COACH_ALLOWED_USER_IDS?.trim() ?? '';
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function canStudentUseAiCoach(userId: string): boolean {
  if (isAiCoachStudentAccessEnabled()) return true;
  return getAiCoachAllowedUserIds().has(userId);
}

export const AI_COACH_LOCKED_MESSAGE =
  'Khawaja AI Coach is not available yet. Your teacher will turn it on when you are ready to use it.';
