import { supabase } from '@/lib/supabase';
import type { ReviewValues, SubmitAssignmentValues } from '@/lib/validation';
import type { Activity, Assignment, AssignmentWithActivity, Review, Submission } from '@/types';

type JoinedRow = Assignment & {
  activity: Activity;
  submissions: (Submission & { reviews: Review[] })[] | null;
};

function mapJoined(row: JoinedRow): AssignmentWithActivity {
  const submission = row.submissions?.[0] ?? null;
  const review = submission?.reviews?.[0] ?? null;
  return {
    ...row,
    activity: row.activity,
    submission,
    review,
  };
}

export const assignmentService = {
  async listForStudent(studentId: string): Promise<AssignmentWithActivity[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select(
        `
        *,
        activity:activities(*),
        submissions(*, reviews(*))
      `,
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as JoinedRow[]).map(mapJoined);
  },

  async listPendingReviews(): Promise<AssignmentWithActivity[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select(
        `
        *,
        activity:activities(*),
        submissions(*, reviews(*))
      `,
      )
      .eq('status', 'submitted')
      .order('updated_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as JoinedRow[]).map(mapJoined);
  },

  async listBySkillForStudent(studentId: string, type: string): Promise<AssignmentWithActivity[]> {
    const all = await this.listForStudent(studentId);
    return all.filter((a) => a.activity.type === type);
  },

  async assign(activityId: string, studentId: string, assignedBy: string, dueAt?: string | null) {
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        activity_id: activityId,
        student_id: studentId,
        assigned_by: assignedBy,
        due_at: dueAt || null,
        status: 'assigned',
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as Assignment;
  },

  async submit(assignmentId: string, studentId: string, values: SubmitAssignmentValues) {
    const { data: submission, error } = await supabase
      .from('submissions')
      .upsert(
        {
          assignment_id: assignmentId,
          student_id: studentId,
          payload: { text: values.text, notes: values.notes || null },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'assignment_id' },
      )
      .select('*')
      .single();
    if (error) throw error;

    const { error: statusError } = await supabase
      .from('assignments')
      .update({ status: 'submitted' })
      .eq('id', assignmentId);
    if (statusError) throw statusError;

    return submission as Submission;
  },

  async review(submissionId: string, reviewerId: string, values: ReviewValues) {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        submission_id: submissionId,
        reviewer_id: reviewerId,
        feedback: values.feedback,
        grade: values.grade || null,
        xp_awarded: values.xp_awarded ?? 50,
        scores: {},
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as Review;
  },

  async getById(id: string): Promise<AssignmentWithActivity | null> {
    const { data, error } = await supabase
      .from('assignments')
      .select(
        `
        *,
        activity:activities(*),
        submissions(*, reviews(*))
      `,
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapJoined(data as JoinedRow);
  },
};
