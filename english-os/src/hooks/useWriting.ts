import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { writingService } from '@/services/writingService';
import type { WritingSubmission } from '@/types';

export const writingKeys = {
  tasks: ['writing', 'tasks'] as const,
  submissions: (taskId: string) => ['writing', 'submissions', taskId] as const,
  mySubmission: (taskId: string, studentId: string) =>
    ['writing', 'mine', taskId, studentId] as const,
};

export function useWritingTasks() {
  return useQuery({
    queryKey: writingKeys.tasks,
    queryFn: () => writingService.listTasks(),
  });
}

export function useWritingSubmissions(taskId: string | undefined) {
  return useQuery({
    queryKey: writingKeys.submissions(taskId ?? ''),
    queryFn: () => writingService.listSubmissions(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useMyWritingSubmission(taskId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: writingKeys.mySubmission(taskId ?? '', studentId ?? ''),
    queryFn: () => writingService.getMySubmission(taskId!, studentId!),
    enabled: Boolean(taskId && studentId),
  });
}

export function useCreateWritingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: writingService.createTask.bind(writingService),
    onSuccess: () => void qc.invalidateQueries({ queryKey: writingKeys.tasks }),
  });
}

export function useCloseWritingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => writingService.closeTask(taskId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: writingKeys.tasks }),
  });
}

export function useReopenWritingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => writingService.reopenTask(taskId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: writingKeys.tasks }),
  });
}

export function useSubmitWriting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof writingService.submit>[0]) =>
      writingService.submit(input),
    onSuccess: (row: WritingSubmission) => {
      void qc.invalidateQueries({ queryKey: writingKeys.submissions(row.task_id) });
      void qc.invalidateQueries({
        queryKey: writingKeys.mySubmission(row.task_id, row.student_id),
      });
    },
  });
}

export function useReviewWriting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof writingService.reviewSubmission>[0]) =>
      writingService.reviewSubmission(input),
    onSuccess: (row: WritingSubmission) => {
      void qc.invalidateQueries({ queryKey: writingKeys.submissions(row.task_id) });
    },
  });
}
