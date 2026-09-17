import { supabase } from '@/lib/supabase';

const REFRESH_BUFFER_SECONDS = 120;

/** Returns a valid access token, refreshing the Supabase session when expired or close to expiry. */
export async function getValidAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session?.expires_at ?? 0;
    const needsRefresh =
      !session?.access_token || expiresAt <= now || expiresAt - now < REFRESH_BUFFER_SECONDS;

    if (!needsRefresh && session?.access_token) {
      return session.access_token;
    }
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  const token = refreshed.session?.access_token;
  if (token) return token;

  throw new Error(
    refreshError?.message ||
      'Your session expired. Sign out, sign in again, then continue reading practice.',
  );
}
