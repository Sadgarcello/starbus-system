import { supabase } from '@/lib/supabase';
import type { CreateStudentValues } from '@/lib/validation';
import type { ExamTrack, Student, StudentWithProfile } from '@/types';

export const studentService = {
  async listForTeacher(teacherId: string): Promise<StudentWithProfile[]> {
    const { data, error } = await supabase
      .from('students')
      .select('*, profile:profiles!students_user_id_fkey(id, email, name, role, avatar, created_at)')
      .or(`teacher_id.eq.${teacherId},teacher_id.is.null`)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => {
      const r = row as Student & { profile: StudentWithProfile['profile'] };
      return { ...r, profile: r.profile };
    });
  },

  async listAll(): Promise<StudentWithProfile[]> {
    const { data, error } = await supabase
      .from('students')
      .select('*, profile:profiles!students_user_id_fkey(id, email, name, role, avatar, created_at)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as StudentWithProfile[];
  },

  async getById(id: string): Promise<StudentWithProfile | null> {
    const { data, error } = await supabase
      .from('students')
      .select('*, profile:profiles!students_user_id_fkey(id, email, name, role, avatar, created_at)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as StudentWithProfile | null;
  },

  /**
   * Creates auth user (pending) then activates via teacher_provision_student RPC.
   * Requires email signup + Confirm email OFF (or the new user has no session/id yet).
   * Restores the teacher session afterward.
   */
  async createStudent(values: CreateStudentValues, teacherId: string): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const teacherSession = sessionData.session;
    if (!teacherSession) throw new Error('Not signed in');

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          name: values.name,
          requested_role: 'student',
        },
      },
    });
    if (signUpError) throw signUpError;

    const { error: restoreError } = await supabase.auth.setSession({
      access_token: teacherSession.access_token,
      refresh_token: teacherSession.refresh_token,
    });
    if (restoreError) throw restoreError;

    let userId = signUpData.user?.id ?? null;
    if (!userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', values.email)
        .maybeSingle();
      userId = profile?.id ?? null;
    }
    if (!userId) {
      throw new Error(
        'Student account created but could not activate. Turn off “Confirm email” in Supabase Auth, or approve them on Approvals.',
      );
    }

    const { error: provisionError } = await supabase.rpc('teacher_provision_student', {
      target_user_id: userId,
      p_level: values.level,
      p_teacher_id: teacherId,
    });
    if (provisionError) throw provisionError;
  },

  async claimStudent(studentId: string, teacherId: string): Promise<void> {
    const { error } = await supabase
      .from('students')
      .update({ teacher_id: teacherId })
      .eq('id', studentId);
    if (error) throw error;
  },

  async recordAppTime(seconds: number): Promise<void> {
    const { error } = await supabase.rpc('record_student_app_time', {
      p_seconds: Math.min(300, Math.max(1, Math.floor(seconds))),
    });
    if (error) throw error;
  },

  async updateExamTrack(studentId: string, examTrack: ExamTrack): Promise<void> {
    const { error } = await supabase
      .from('students')
      .update({ exam_track: examTrack })
      .eq('id', studentId);
    if (error) throw error;
  },
};
