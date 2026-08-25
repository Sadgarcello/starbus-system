import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { SetupBanner } from '@/components/common/SetupBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/env';
import { registerSchema, type RegisterValues } from '@/lib/validation';
import { paths } from '@/routes/paths';

export default function RegisterPage() {
  const { isAuthenticated, isActive, isPending, isRejected, isLocked, signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  if (isAuthenticated && isActive) return <Navigate to={paths.home} replace />;
  if (isAuthenticated && (isPending || isRejected || isLocked || !isActive)) {
    return <Navigate to={paths.pending} replace />;
  }

  async function onSubmit(values: RegisterValues) {
    if (!isSupabaseConfigured) {
      setError('Configure Supabase first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signUp(values);
      navigate(paths.pending, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Join Khawaja Club</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Request a student account. An admin will approve before you can enter Khawaja Club.
        </p>
      </div>
      <SetupBanner />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Full name" error={errors.name?.message}>
          <Input {...register('name')} autoComplete="name" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting}>
          Request access
        </Button>
      </form>
      <p className="text-center text-sm text-ink-subtle">
        Already have an account?{' '}
        <Link to={paths.login} className="font-bold text-ink underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
