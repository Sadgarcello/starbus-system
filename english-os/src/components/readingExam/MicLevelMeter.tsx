import type { MicLevelLabel } from '@/hooks/useMicLevelMeter';

const LABEL_TEXT: Record<MicLevelLabel, string | null> = {
  idle: null,
  too_quiet: 'Too Quiet',
  good: 'Good',
  too_loud: 'Too Loud',
};

export function MicLevelMeter({
  bars,
  barCount,
  label,
  variant = 'live',
}: {
  bars: number;
  barCount: number;
  label: MicLevelLabel;
  variant?: 'live' | 'example-good' | 'example-loud';
}) {
  const filled =
    variant === 'example-good' ? 8 : variant === 'example-loud' ? 18 : bars;
  const fillClass =
    variant === 'example-loud' || label === 'too_loud'
      ? 'bg-danger'
      : 'bg-ink';

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-0.5">
        {Array.from({ length: barCount }, (_, i) => (
          <div
            key={i}
            className={`h-8 w-1.5 rounded-sm border border-paper-line ${
              i < filled ? fillClass : 'bg-paper-soft'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-ink-subtle">
        <span>Too Quiet</span>
        <span>Good</span>
        <span>Too Loud</span>
      </div>
      {variant === 'live' && label !== 'idle' && (
        <p
          className={`text-sm font-semibold ${
            label === 'good'
              ? 'text-success'
              : label === 'too_loud'
                ? 'text-danger'
                : 'text-ink-muted'
          }`}
        >
          {label === 'good' ? '✓ Good' : label === 'too_loud' ? '✗ Too Loud' : 'Speak a little louder'}
        </p>
      )}
      {variant === 'example-good' && (
        <p className="text-sm font-semibold text-success">✓ Good</p>
      )}
      {variant === 'example-loud' && (
        <p className="text-sm font-semibold text-danger">✗ Too Loud</p>
      )}
      {variant === 'live' && label === 'idle' && (
        <p className="text-sm text-ink-subtle">{LABEL_TEXT.idle ?? 'Waiting for microphone…'}</p>
      )}
    </div>
  );
}
