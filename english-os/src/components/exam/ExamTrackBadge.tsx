import type { ExamTrack } from '@/lib/examTrackContent';
import { EXAM_TRACK_LABELS } from '@/lib/examTrackContent';
import { ExamTrackLogo } from '@/components/exam/ExamTrackLogo';
import { cn } from '@/utils/cn';

interface ExamTrackBadgeProps {
  track: ExamTrack;
  className?: string;
  showLogo?: boolean;
}

export function ExamTrackBadge({ track, className, showLogo = true }: ExamTrackBadgeProps) {
  if (showLogo) {
    return (
      <span
        className={cn('inline-flex items-center', className)}
        title={EXAM_TRACK_LABELS[track]}
      >
        <ExamTrackLogo track={track} variant="badge" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        className,
      )}
    >
      {EXAM_TRACK_LABELS[track]}
    </span>
  );
}
