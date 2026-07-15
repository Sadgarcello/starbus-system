import { supabase } from '@/lib/supabase';
import type {
  WritingSubmission,
  WritingSubmissionWithStudent,
  WritingTask,
} from '@/types';

const BUCKET = 'writing-photos';

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function compressPhoto(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('Could not compress image');
  return blob;
}

export const writingService = {
  todayLocal,

  async listTasks(): Promise<WritingTask[]> {
    const { data, error } = await supabase
      .from('writing_tasks')
      .select('*')
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WritingTask[];
  },

  async createTask(input: {
    title: string;
    instructions: string;
    sessionDate?: string;
    createdBy: string;
  }): Promise<WritingTask> {
    const title = input.title.trim();
    const instructions = input.instructions.trim();
    if (title.length < 2) throw new Error('Title is required');
    if (instructions.length < 2) throw new Error('Instructions are required');

    const { data, error } = await supabase
      .from('writing_tasks')
      .insert({
        title,
        instructions,
        session_date: input.sessionDate ?? todayLocal(),
        status: 'open',
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as WritingTask;
  },

  async closeTask(taskId: string): Promise<WritingTask> {
    const { data, error } = await supabase
      .from('writing_tasks')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', taskId)
      .select('*')
      .single();
    if (error) throw error;
    return data as WritingTask;
  },

  async reopenTask(taskId: string): Promise<WritingTask> {
    const { data, error } = await supabase
      .from('writing_tasks')
      .update({ status: 'open', closed_at: null })
      .eq('id', taskId)
      .select('*')
      .single();
    if (error) throw error;
    return data as WritingTask;
  },

  async getMySubmission(taskId: string, studentId: string): Promise<WritingSubmission | null> {
    const { data, error } = await supabase
      .from('writing_submissions')
      .select('*')
      .eq('task_id', taskId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) throw error;
    return data as WritingSubmission | null;
  },

  async listSubmissions(taskId: string): Promise<WritingSubmissionWithStudent[]> {
    const { data, error } = await supabase
      .from('writing_submissions')
      .select('*, student:students(id, profile:profiles!students_user_id_fkey(name, email, avatar))')
      .eq('task_id', taskId)
      .order('submitted_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as WritingSubmissionWithStudent[];
  },

  async uploadPhoto(userId: string, taskId: string, file: File): Promise<string> {
    const blob = await compressPhoto(file);
    const path = `${userId}/${taskId}/handwriting.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });
    if (error) throw error;
    return path;
  },

  async getPhotoUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data.signedUrl;
  },

  async submit(input: {
    taskId: string;
    studentId: string;
    userId: string;
    bodyText?: string;
    photoFile?: File | null;
    existingPhotoPath?: string | null;
  }): Promise<WritingSubmission> {
    const text = input.bodyText?.trim() || null;
    let photoPath = input.existingPhotoPath ?? null;

    if (input.photoFile) {
      photoPath = await this.uploadPhoto(input.userId, input.taskId, input.photoFile);
    }

    if (!text && !photoPath) {
      throw new Error('Paste your writing or upload a photo of handwritten work.');
    }

    const { data: existing } = await supabase
      .from('writing_submissions')
      .select('id')
      .eq('task_id', input.taskId)
      .eq('student_id', input.studentId)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase
        .from('writing_submissions')
        .update({
          body_text: text,
          photo_path: photoPath,
          submitted_at: new Date().toISOString(),
          status: 'submitted',
          feedback: null,
          grade: null,
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as WritingSubmission;
    }

    const { data, error } = await supabase
      .from('writing_submissions')
      .insert({
        task_id: input.taskId,
        student_id: input.studentId,
        body_text: text,
        photo_path: photoPath,
        status: 'submitted',
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as WritingSubmission;
  },

  async reviewSubmission(input: {
    submissionId: string;
    feedback: string;
    grade?: string;
    reviewerId: string;
  }): Promise<WritingSubmission> {
    const { data, error } = await supabase
      .from('writing_submissions')
      .update({
        status: 'reviewed',
        feedback: input.feedback.trim() || null,
        grade: input.grade?.trim() || null,
        reviewed_by: input.reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', input.submissionId)
      .select('*')
      .single();
    if (error) throw error;
    return data as WritingSubmission;
  },
};
