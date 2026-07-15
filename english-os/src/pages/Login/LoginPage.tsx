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
import { loginSchema, type LoginValues } from '@/lib/validation';
import { paths } from '@/routes/paths';

export default function LoginPage() {
  const { isAuthenticated, loading, isActive, isPending, isRejected, isLocked, signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  if (!loading && isAuthenticated) {
    if (isActive) return <Navigate to={paths.dashboard} replace />;
    if (isPending || isRejected || isLocked || !isActive) {
      return <Navigate to={paths.pending} replace />;
    }
  }

  async function onSubmit(values: LoginValues) {
    if (!isSupabaseConfigured) {
      setError('Configure Supabase first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(values.email, values.password);
      // ProtectedRoute sends pending/locked/rejected to /pending
      navigate(paths.dashboard, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-ink-subtle">Sign in to your Khawaja Club account.</p>
      </div>
      <SetupBanner />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting}>
          Enter Khawaja Club
        </Button>
      </form>
      <p className="text-center text-sm text-ink-subtle">
        New here?{' '}
        <Link to={paths.register} className="font-bold text-ink underline">
          Request access
        </Link>
      </p>
    </Card>
  );
}
