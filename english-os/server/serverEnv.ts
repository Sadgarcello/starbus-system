function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function supabaseProjectRef(supabaseUrl: string): string {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Supabase server env for API routes (no VAPID required). */
export function getSupabaseServerEnv() {
  const supabaseUrl = nonEmpty(process.env.SUPABASE_URL) ?? nonEmpty(process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = nonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY);
  // Prefer VITE anon key so token verification matches the browser Supabase client.
  const anonKey =
    nonEmpty(process.env.VITE_SUPABASE_ANON_KEY) ??
    nonEmpty(process.env.SUPABASE_ANON_KEY) ??
    serviceRoleKey;

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false as const, error: 'missing_supabase_env' as const };
  }

  return {
    ok: true as const,
    supabaseUrl,
    serviceRoleKey,
    anonKey: anonKey ?? serviceRoleKey,
    projectRef: supabaseProjectRef(supabaseUrl),
  };
}
