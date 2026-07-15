import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env';

const placeholderUrl = 'https://placeholder.supabase.co';
const placeholderKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? env.supabaseUrl : placeholderUrl,
  isSupabaseConfigured ? env.supabaseAnonKey : placeholderKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
