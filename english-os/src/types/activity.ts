import type { ActivityType, AssignmentStatus } from './database';

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'speaking', label: 'Speaking' },
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'listening', label: 'Listening' },
];

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: 'Assigned',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  returned: 'Returned',
};

export function skillPath(type: ActivityType): string {
  return `/${type}`;
}
