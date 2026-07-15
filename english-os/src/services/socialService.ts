import { supabase } from '@/lib/supabase';
import type { SocialProfile } from '@/types';

export const socialService = {
  async listProfiles(): Promise<SocialProfile[]> {
    const { data, error } = await supabase.rpc('list_social_profiles');
    if (error) throw error;
    return (data ?? []) as SocialProfile[];
  },
};
