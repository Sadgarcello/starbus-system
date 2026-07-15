import { supabase } from '@/lib/supabase';
import type { Hobby, HobbySuggestion, HobbySuggestionWithStudent, StudentWithProfile } from '@/types';

function parseRpcJson(data: unknown): { status: string; hobby_id?: string } {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as { status: string; hobby_id?: string };
    } catch {
      return { status: 'unknown' };
    }
  }
  if (data && typeof data === 'object') {
    return data as { status: string; hobby_id?: string };
  }
  return { status: 'unknown' };
}

export const hobbyService = {
  async listCatalog(): Promise<Hobby[]> {
    const { data, error } = await supabase
      .from('hobbies')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Hobby[];
  },

  async listForStudent(studentId: string): Promise<Hobby[]> {
    const { data, error } = await supabase
      .from('student_hobbies')
      .select('hobby_id, hobby:hobbies(*)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? [])
      .map((row) => (row as unknown as { hobby: Hobby | null }).hobby)
      .filter((h): h is Hobby => Boolean(h));
  },

  async listMyPendingSuggestions(studentId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('hobby_suggestions')
      .select('raw_text')
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => r.raw_text as string);
  },

  async listPendingSuggestions(): Promise<HobbySuggestionWithStudent[]> {
    // Two-step fetch avoids PostgREST failing on ambiguous students↔profiles FKs
    const { data, error } = await supabase
      .from('hobby_suggestions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as HobbySuggestion[];
    if (rows.length === 0) return [];

    const studentIds = [...new Set(rows.map((r) => r.student_id))];
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select(
        '*, profile:profiles!students_user_id_fkey(id, email, name, role, avatar, created_at)',
      )
      .in('id', studentIds);
    if (studentError) throw studentError;

    const byId = new Map(
      ((students ?? []) as unknown as StudentWithProfile[]).map((s) => [s.id, s]),
    );

    return rows.map((row) => ({
      ...row,
      student: byId.get(row.student_id) as StudentWithProfile,
    }));
  },

  async requestOrAdd(rawInterest: string): Promise<{ status: string; hobby_id?: string }> {
    const { data, error } = await supabase.rpc('request_or_add_hobby', {
      raw_interest: rawInterest,
    });
    if (error) throw error;
    return parseRpcJson(data);
  },

  async addExisting(studentId: string, hobbyId: string): Promise<void> {
    const { error } = await supabase.from('student_hobbies').insert({
      student_id: studentId,
      hobby_id: hobbyId,
    });
    if (error) throw error;
  },

  async remove(studentId: string, hobbyId: string): Promise<void> {
    const { error } = await supabase
      .from('student_hobbies')
      .delete()
      .eq('student_id', studentId)
      .eq('hobby_id', hobbyId);
    if (error) throw error;
  },

  async normalize(suggestionId: string, canonicalName: string): Promise<void> {
    const { error } = await supabase.rpc('normalize_hobby_suggestion', {
      suggestion_id: suggestionId,
      canonical_name: canonicalName,
    });
    if (error) throw error;
  },

  async rejectSuggestion(suggestionId: string): Promise<void> {
    const { error } = await supabase.rpc('reject_hobby_suggestion', {
      suggestion_id: suggestionId,
    });
    if (error) throw error;
  },
};
