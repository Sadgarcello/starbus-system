import type { ExamTrack } from '@/lib/examTrackContent';
import { EXAM_TRACK_LABELS, EXAM_TRACK_LOGOS } from '@/lib/examTrackContent';
import { cn } from '@/utils/cn';

interface ExamTrackLogoProps {
  track: ExamTrack;
  variant?: 'card' | 'badge' | 'inline';
  className?: string;
}

const VARIANT_CLASS: Record<NonNullable<ExamTrackLogoProps['variant']>, string> = {
  card: 'h-10 max-w-[140px] object-contain object-left',
  badge: 'h-5 max-w-[72px] object-contain object-left',
  inline: 'h-6 max-w-[96px] object-contain object-left',
};

export function ExamTrackLogo({ track, variant = 'card', className }: ExamTrackLogoProps) {
  return (
    <img
      src={EXAM_TRACK_LOGOS[track]}
      alt={EXAM_TRACK_LABELS[track]}
      className={cn(VARIANT_CLASS[variant], className)}
      loading="lazy"
      decoding="async"
    />
  );
}
