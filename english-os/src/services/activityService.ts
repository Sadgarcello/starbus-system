import { supabase } from '@/lib/supabase';
import type { CreateActivityValues } from '@/lib/validation';
import type { Activity, ActivityType } from '@/types';

export const activityService = {
  async list(type?: ActivityType): Promise<Activity[]> {
    let query = supabase.from('activities').select('*').order('created_at', { ascending: false });
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Activity[];
  },

  async create(values: CreateActivityValues, createdBy: string): Promise<Activity> {
    const { data, error } = await supabase
      .from('activities')
      .insert({
        lesson_id: values.lesson_id || null,
        type: values.type,
        title: values.title,
        description: values.description || null,
        xp: values.xp ?? 50,
        created_by: createdBy,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as Activity;
  },
};
