import { cn } from '@/utils/cn';

const COLORS: Record<string, string> = {
  overall: '#1b7a3d',
  speaking: '#2d6a4f',
  reading: '#f5c518',
  writing: '#3a7ca5',
  listening: '#1d3557',
};

interface SkillGaugeProps {
  label: string;
  percent: number;
  skillKey?: string;
  size?: number;
  className?: string;
}

export function SkillGauge({
  label,
  percent,
  skillKey = 'overall',
  size = 96,
  className,
}: SkillGaugeProps) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c - (clamped / 100) * c;
  const color = COLORS[skillKey] ?? COLORS.overall;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e8e8e4"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-xl text-ink sm:text-2xl">{clamped}%</span>
        </div>
      </div>
      <p className="max-w-[7rem] text-center text-[11px] font-semibold uppercase tracking-wide text-ink-subtle sm:text-xs">
        {label}
      </p>
    </div>
  );
}
