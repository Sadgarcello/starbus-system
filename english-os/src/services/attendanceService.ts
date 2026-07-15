import { supabase } from '@/lib/supabase';
import type {
  AttendanceMark,
  AttendanceMarkWithStudent,
  AttendanceSession,
  StudentWithProfile,
} from '@/types';

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const attendanceService = {
  todayLocal,

  async getSessionByDate(sessionDate: string): Promise<AttendanceSession | null> {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('session_date', sessionDate)
      .maybeSingle();
    if (error) throw error;
    return data as AttendanceSession | null;
  },

  /** Create session if missing, then set status = open. */
  async openSession(sessionDate: string, teacherId: string): Promise<AttendanceSession> {
    const existing = await this.getSessionByDate(sessionDate);
    const now = new Date().toISOString();

    if (existing) {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .update({
          status: 'open',
          opened_by: teacherId,
          opened_at: now,
          closed_at: null,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as AttendanceSession;
    }

    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({
        session_date: sessionDate,
        status: 'open',
        opened_by: teacherId,
        opened_at: now,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as AttendanceSession;
  },

  async closeSession(sessionId: string): Promise<AttendanceSession> {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select('*')
      .single();
    if (error) throw error;
    return data as AttendanceSession;
  },

  async listMarksForSession(sessionId: string): Promise<AttendanceMarkWithStudent[]> {
    const { data, error } = await supabase
      .from('attendance_marks')
      .select('*, student:students(*, profile:profiles(*))')
      .eq('session_id', sessionId)
      .order('marked_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AttendanceMarkWithStudent[];
  },

  async getMyMark(sessionId: string, studentId: string): Promise<AttendanceMark | null> {
    const { data, error } = await supabase
      .from('attendance_marks')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) throw error;
    return data as AttendanceMark | null;
  },

  async markPresent(sessionId: string, studentId: string): Promise<AttendanceMark> {
    const { data, error } = await supabase
      .from('attendance_marks')
      .insert({ session_id: sessionId, student_id: studentId })
      .select('*')
      .single();
    if (error) throw error;
    return data as AttendanceMark;
  },

  async listMarksForStudent(studentId: string): Promise<
    Array<AttendanceMark & { session: AttendanceSession }>
  > {
    const { data, error } = await supabase
      .from('attendance_marks')
      .select('*, session:attendance_sessions(*)')
      .eq('student_id', studentId)
      .order('marked_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<AttendanceMark & { session: AttendanceSession }>;
  },

  async rosterPresence(
    sessionId: string,
    students: StudentWithProfile[],
  ): Promise<{ present: StudentWithProfile[]; absent: StudentWithProfile[] }> {
    const marks = await this.listMarksForSession(sessionId);
    const presentIds = new Set(marks.map((m) => m.student_id));
    const present = students.filter((s) => presentIds.has(s.id));
    const absent = students.filter((s) => !presentIds.has(s.id));
    return { present, absent };
  },
};
