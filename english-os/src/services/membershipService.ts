import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';

const PROFILE_COLUMNS =
  'id, email, name, role, status, requested_role, avatar, is_locked, created_at';

export const membershipService = {
  async listPending(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async listStudents(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('role', 'student')
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async listByStatus(status: 'pending' | 'active' | 'rejected'): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async approve(userId: string, role: UserRole = 'student'): Promise<void> {
    const grantRole = role === 'admin' ? 'student' : role;
    const { error } = await supabase.rpc('approve_member', {
      target_id: userId,
      grant_role: grantRole,
    });
    if (error) throw error;
  },

  async reject(userId: string): Promise<void> {
    const { error } = await supabase.rpc('reject_member', { target_id: userId });
    if (error) throw error;
  },

  async setLocked(userId: string, locked: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_member_locked', {
      target_id: userId,
      locked,
    });
    if (error) throw error;
  },
};
