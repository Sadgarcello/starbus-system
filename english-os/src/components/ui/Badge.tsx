import { cn } from '@/utils/cn';
import type { ActivityType, AssignmentStatus } from '@/types';

const statusClass: Record<AssignmentStatus, string> = {
  assigned: 'bg-club-soft text-ink',
  submitted: 'bg-ink text-club',
  reviewed: 'bg-success/15 text-success',
  returned: 'bg-danger/10 text-danger',
};

const typeClass: Record<ActivityType, string> = {
  speaking: 'border-ink',
  reading: 'border-ink',
  writing: 'border-ink',
  listening: 'border-ink',
};

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', statusClass[status])}>
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: ActivityType }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border bg-paper px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink',
        typeClass[type],
      )}
    >
      {type}
    </span>
  );
}
