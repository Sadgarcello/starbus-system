import { supabase } from '@/lib/supabase';
import type { ListeningPick, ListeningPickWithStudent } from '@/types';

export const listeningService = {
  async listPicks(): Promise<ListeningPickWithStudent[]> {
    const { data, error } = await supabase
      .from('listening_picks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as ListeningPick[];
    if (rows.length === 0) return [];

    const studentIds = [...new Set(rows.map((r) => r.student_id))];
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, profile:profiles!students_user_id_fkey(name, email, avatar)')
      .in('id', studentIds);
    if (studentError) throw studentError;

    const byId = new Map(
      (
        (students ?? []) as unknown as Array<{
          id: string;
          profile: { name: string | null; email: string; avatar: string | null } | null;
        }>
      ).map((s) => [s.id, s]),
    );

    return rows.map((row) => ({
      ...row,
      student: byId.get(row.student_id) ?? null,
    }));
  },

  async submitPick(input: {
    studentId: string;
    clipName: string;
    topic: string;
    url?: string;
    whyChose: string;
    whatUnderstood: string;
    opinion: string;
  }): Promise<ListeningPick> {
    const clip_name = input.clipName.trim();
    const topic = input.topic.trim();
    const why_chose = input.whyChose.trim();
    const what_understood = input.whatUnderstood.trim();
    const opinion = input.opinion.trim();
    const url = input.url?.trim() || null;

    if (!clip_name) throw new Error('Clip name is required');
    if (!topic) throw new Error('Topic is required');
    if (!why_chose) throw new Error('Explain why you chose it');
    if (!what_understood) throw new Error('Explain what you understood');
    if (!opinion) throw new Error('Share your personal opinion');

    const { data, error } = await supabase
      .from('listening_picks')
      .insert({
        student_id: input.studentId,
        clip_name,
        topic,
        url,
        why_chose,
        what_understood,
        opinion,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as ListeningPick;
  },

  async deletePick(pickId: string): Promise<void> {
    const { error } = await supabase.from('listening_picks').delete().eq('id', pickId);
    if (error) throw error;
  },
};
