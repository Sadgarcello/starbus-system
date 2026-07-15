import { getMissingEnvVars, isSupabaseConfigured } from '@/lib/env';

export function SetupBanner() {
  if (isSupabaseConfigured) return null;
  const missing = getMissingEnvVars();
  return (
    <div className="rounded-md border border-ink bg-club-soft px-4 py-3 text-sm text-ink">
      <p className="font-bold">Configure Supabase</p>
      <p className="mt-1 text-ink-muted">
        Copy <code className="font-mono text-xs">.env.example</code> to{' '}
        <code className="font-mono text-xs">.env</code> and set: {missing.join(', ')}
      </p>
    </div>
  );
}
