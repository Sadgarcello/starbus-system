import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
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
