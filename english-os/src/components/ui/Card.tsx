import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-lg border border-paper-line bg-paper shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-paper-line px-4 py-3">
      <div>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
