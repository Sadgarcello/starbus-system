import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { RegisterValues } from '@/lib/validation';
import type { Profile, Student } from '@/types';

const PROFILE_COLUMNS =
  'id, email, name, role, status, requested_role, avatar, is_locked, created_at';

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signUp(values: RegisterValues) {
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          name: values.name,
          requested_role: 'student',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },

  async getStudentByUserId(userId: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data as Student | null;
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
