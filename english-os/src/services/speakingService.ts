import { supabase } from '@/lib/supabase';
import type {
  SpeakingDaySession,
  SpeakingDaySessionWithFormat,
  SpeakingFormat,
  SpeakingFormatVoter,
  SpeakingPracticeMark,
} from '@/types';

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const speakingService = {
  todayLocal,

  async listFormats(): Promise<SpeakingFormat[]> {
    const { data, error } = await supabase
      .from('speaking_formats')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as SpeakingFormat[];
  },

  slugify(title: string): string {
    return title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  },

  async createFormat(input: {
    title: string;
    details: string;
    goal: string;
  }): Promise<SpeakingFormat> {
    const title = input.title.trim();
    const details = input.details.trim();
    const goal = input.goal.trim();
    if (title.length < 2) throw new Error('Title is required');
    if (details.length < 2) throw new Error('Details are required');
    if (goal.length < 2) throw new Error('Goal is required');

    const baseSlug = this.slugify(title) || `format-${Date.now()}`;
    let slug = baseSlug;
    let attempt = 0;

    // Resolve unique slug collisions
    while (attempt < 5) {
      const { data, error } = await supabase
        .from('speaking_formats')
        .insert({
          title,
          details,
          goal,
          slug,
          sort_order: Date.now() % 100000,
        })
        .select('*')
        .single();

      if (!error) return data as SpeakingFormat;
      if (!error.message?.includes('duplicate') && error.code !== '23505') throw error;
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
    }
    throw new Error('Could not create a unique slug for this title');
  },

  async deleteFormat(formatId: string): Promise<void> {
    const { error } = await supabase.from('speaking_formats').delete().eq('id', formatId);
    if (error) throw error;
  },

  async listVotes(): Promise<SpeakingFormatVoter[]> {
    const { data, error } = await supabase
      .from('speaking_format_votes')
      .select('student_id, format_id, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const studentIds = [...new Set(rows.map((r) => r.student_id as string))];
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select(
        'id, profile:profiles!students_user_id_fkey(id, email, name, avatar)',
      )
      .in('id', studentIds);
    if (studentError) throw studentError;

    const byId = new Map(
      (students ?? []).map((s) => {
        const row = s as unknown as {
          id: string;
          profile: { name: string | null; email: string; avatar: string | null } | null;
        };
        return [row.id, row.profile];
      }),
    );

    return rows.map((r) => {
      const profile = byId.get(r.student_id as string);
      return {
        student_id: r.student_id as string,
        format_id: r.format_id as string,
        name: profile?.name ?? null,
        email: profile?.email ?? '',
        avatar: profile?.avatar ?? null,
      };
    });
  },

  async vote(formatId: string): Promise<void> {
    const { error } = await supabase.rpc('vote_speaking_format', {
      p_format_id: formatId,
    });
    if (error) throw error;
  },

  async clearVote(): Promise<void> {
    const { error } = await supabase.rpc('clear_speaking_vote');
    if (error) throw error;
  },

  async getSessionByDate(sessionDate: string): Promise<SpeakingDaySessionWithFormat | null> {
    const { data, error } = await supabase
      .from('speaking_day_sessions')
      .select('*, format:speaking_formats(*)')
      .eq('session_date', sessionDate)
      .maybeSingle();
    if (error) throw error;
    return data as SpeakingDaySessionWithFormat | null;
  },

  async openDay(formatId: string, sessionDate?: string): Promise<SpeakingDaySession> {
    const { data, error } = await supabase.rpc('open_speaking_day', {
      p_format_id: formatId,
      p_session_date: sessionDate ?? todayLocal(),
    });
    if (error) throw error;
    return data as SpeakingDaySession;
  },

  async closeDay(sessionId: string): Promise<SpeakingDaySession> {
    const { data, error } = await supabase.rpc('close_speaking_day', {
      p_session_id: sessionId,
    });
    if (error) throw error;
    return data as SpeakingDaySession;
  },

  async getMyMark(sessionId: string, studentId: string): Promise<SpeakingPracticeMark | null> {
    const { data, error } = await supabase
      .from('speaking_practice_marks')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) throw error;
    return data as SpeakingPracticeMark | null;
  },

  async listMarks(sessionId: string): Promise<SpeakingPracticeMark[]> {
    const { data, error } = await supabase
      .from('speaking_practice_marks')
      .select('*')
      .eq('session_id', sessionId)
      .order('marked_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as SpeakingPracticeMark[];
  },

  async markPractice(sessionId: string): Promise<{
    speaking_progress: number;
    leveled_up: boolean;
    level: string;
  }> {
    const { data, error } = await supabase.rpc('mark_speaking_practice', {
      p_session_id: sessionId,
    });
    if (error) throw error;
    const parsed =
      typeof data === 'string'
        ? (JSON.parse(data) as { speaking_progress: number; leveled_up: boolean; level: string })
        : (data as { speaking_progress: number; leveled_up: boolean; level: string });
    return parsed;
  },
};
