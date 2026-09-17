import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { examAnswerInputClassName, examTextInputProps, examTextareaProps } from '@/lib/examInputAssist';
import { cn } from '@/utils/cn';

export function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5" htmlFor={htmlFor}>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</span>
      {children}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}

const controlClass =
  'w-full rounded-md border border-paper-line bg-paper px-3 py-2.5 text-base text-ink outline-none transition placeholder:text-ink-subtle focus:border-ink focus:ring-2 focus:ring-club/40 sm:py-2 sm:text-sm';

type ExamSafeProps = { examSafe?: boolean };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & ExamSafeProps>(
  function Input({ className, examSafe, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(controlClass, examSafe && examAnswerInputClassName, className)}
        {...(examSafe ? examTextInputProps : {})}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & ExamSafeProps>(
  function Textarea({ className, examSafe, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(controlClass, examSafe && examAnswerInputClassName, className)}
        {...(examSafe ? examTextareaProps : {})}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(controlClass, className)} {...props}>
        {children}
      </select>
    );
  },
);
