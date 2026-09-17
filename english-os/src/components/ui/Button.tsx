import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'practiceContinue';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-club hover:bg-ink-muted border border-ink',
  secondary: 'bg-paper text-ink border border-paper-line hover:border-ink',
  ghost: 'bg-transparent text-ink hover:bg-paper-line',
  danger: 'bg-danger text-white hover:opacity-90',
  /** Read in Daily Life — yellow CTA */
  gold: 'border-[#FBBF24] bg-[#FBBF24] text-ink hover:bg-[#E5AB1F] hover:text-ink disabled:border-paper-line disabled:bg-paper-line disabled:text-ink-subtle',
  /** Complete the Words — dark button, yellow label */
  practiceContinue: 'border-ink bg-ink text-[#FBBF24] hover:bg-ink-muted hover:text-[#FBBF24]',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-md font-semibold transition disabled:opacity-50 touch-manipulation',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '…' : children}
    </button>
  );
}
