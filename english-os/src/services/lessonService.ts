import { supabase } from '@/lib/supabase';
import type { CreateLessonValues } from '@/lib/validation';
import type { Lesson } from '@/types';

export const lessonService = {
  async list(): Promise<Lesson[]> {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Lesson[];
  },

  async create(values: CreateLessonValues, createdBy: string): Promise<Lesson> {
    const { data, error } = await supabase
      .from('lessons')
      .insert({
        title: values.title,
        week: values.week ?? null,
        theme: values.theme || null,
        novel: values.novel || null,
        chapter: values.chapter || null,
        created_by: createdBy,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as Lesson;
  },
};
