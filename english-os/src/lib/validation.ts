import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type RegisterValues = z.infer<typeof registerSchema>;

export const createStudentSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(120),
  level: z.string().min(1, 'Level is required').max(20),
});
export type CreateStudentValues = z.infer<typeof createStudentSchema>;

export const createLessonSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  week: z.number().int().min(0).max(52).nullable().optional(),
  theme: z.string().max(200).nullable().optional(),
  novel: z.string().max(200).nullable().optional(),
  chapter: z.string().max(100).nullable().optional(),
});
export type CreateLessonValues = z.infer<typeof createLessonSchema>;

export const createActivitySchema = z.object({
  lesson_id: z.string().nullable().optional(),
  type: z.enum(['speaking', 'reading', 'writing', 'listening']),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  xp: z.number().int().min(0).max(1000),
});
export type CreateActivityValues = z.infer<typeof createActivitySchema>;

export const assignActivitySchema = z.object({
  activity_id: z.string().uuid(),
  student_id: z.string().uuid(),
  due_at: z.string().nullable().optional(),
});
export type AssignActivityValues = z.infer<typeof assignActivitySchema>;

export const submitAssignmentSchema = z.object({
  text: z.string().min(1, 'Write or paste your work').max(20000),
  notes: z.string().max(2000).nullable().optional(),
});
export type SubmitAssignmentValues = z.infer<typeof submitAssignmentSchema>;

export const reviewSchema = z.object({
  feedback: z.string().min(1, 'Feedback is required').max(5000),
  grade: z.string().max(20).nullable().optional(),
  xp_awarded: z.number().int().min(0).max(1000),
});
export type ReviewValues = z.infer<typeof reviewSchema>;
