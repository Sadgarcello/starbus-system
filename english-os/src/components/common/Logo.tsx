import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

const logoSrc = '/khawaja-club-logo.png';

export function Logo({
  compact = false,
  className,
  size = 'md',
}: {
  compact?: boolean;
  className?: string;
  /** Image size: sm header · md default · lg auth */
  size?: 'sm' | 'md' | 'lg';
}) {
  const imgClass =
    size === 'lg' ? 'h-28 w-28 sm:h-32 sm:w-32' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';

  return (
    <Link to="/" className={cn('flex items-center gap-3', className)}>
      <img
        src={logoSrc}
        alt="Khawaja Club"
        width={size === 'lg' ? 128 : size === 'sm' ? 36 : 44}
        height={size === 'lg' ? 128 : size === 'sm' ? 36 : 44}
        className={cn('shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/10', imgClass)}
      />
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-xl text-ink">Khawaja Club</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">English Club</p>
        </div>
      )}
    </Link>
  );
}
