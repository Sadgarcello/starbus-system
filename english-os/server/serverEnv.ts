/** Supabase server env for API routes (no VAPID required). */
export function getSupabaseServerEnv() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false as const, error: 'missing_supabase_env' as const };
  }

  return {
    ok: true as const,
    supabaseUrl,
    serviceRoleKey,
    anonKey: anonKey ?? serviceRoleKey,
  };
}
