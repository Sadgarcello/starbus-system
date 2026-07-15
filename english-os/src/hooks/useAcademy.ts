import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityService } from '@/services/activityService';
import { assignmentService } from '@/services/assignmentService';
import { lessonService } from '@/services/lessonService';
import { studentService } from '@/services/studentService';
import type { CreateActivityValues, CreateLessonValues, CreateStudentValues, ReviewValues, SubmitAssignmentValues } from '@/lib/validation';
import type { ActivityType } from '@/types';

export const academyKeys = {
  students: ['students'] as const,
  lessons: ['lessons'] as const,
  activities: (type?: ActivityType) => ['activities', type ?? 'all'] as const,
  studentAssignments: (studentId: string) => ['assignments', 'student', studentId] as const,
  pendingReviews: ['assignments', 'pending'] as const,
  assignment: (id: string) => ['assignments', id] as const,
};

export function useStudents(teacherId?: string) {
  return useQuery({
    queryKey: [...academyKeys.students, teacherId],
    queryFn: () => (teacherId ? studentService.listForTeacher(teacherId) : studentService.listAll()),
    enabled: Boolean(teacherId),
  });
}

export function useLessons() {
  return useQuery({
    queryKey: academyKeys.lessons,
    queryFn: () => lessonService.list(),
  });
}

export function useActivities(type?: ActivityType) {
  return useQuery({
    queryKey: academyKeys.activities(type),
    queryFn: () => activityService.list(type),
  });
}

export function useStudentAssignments(studentId?: string) {
  return useQuery({
    queryKey: academyKeys.studentAssignments(studentId ?? ''),
    queryFn: () => assignmentService.listForStudent(studentId as string),
    enabled: Boolean(studentId),
  });
}

export function usePendingReviews(enabled = true) {
  return useQuery({
    queryKey: academyKeys.pendingReviews,
    queryFn: () => assignmentService.listPendingReviews(),
    enabled,
  });
}

export function useAssignment(id?: string) {
  return useQuery({
    queryKey: academyKeys.assignment(id ?? ''),
    queryFn: () => assignmentService.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ values, teacherId }: { values: CreateStudentValues; teacherId: string }) =>
      studentService.createStudent(values, teacherId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: academyKeys.students }),
  });
}

export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ values, createdBy }: { values: CreateLessonValues; createdBy: string }) =>
      lessonService.create(values, createdBy),
    onSuccess: () => void qc.invalidateQueries({ queryKey: academyKeys.lessons }),
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ values, createdBy }: { values: CreateActivityValues; createdBy: string }) =>
      activityService.create(values, createdBy),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

export function useAssignActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      activityId,
      studentId,
      assignedBy,
      dueAt,
    }: {
      activityId: string;
      studentId: string;
      assignedBy: string;
      dueAt?: string | null;
    }) => assignmentService.assign(activityId, studentId, assignedBy, dueAt),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      studentId,
      values,
    }: {
      assignmentId: string;
      studentId: string;
      values: SubmitAssignmentValues;
    }) => assignmentService.submit(assignmentId, studentId, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

export function useReviewAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      reviewerId,
      values,
    }: {
      submissionId: string;
      reviewerId: string;
      values: ReviewValues;
    }) => assignmentService.review(submissionId, reviewerId, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}
