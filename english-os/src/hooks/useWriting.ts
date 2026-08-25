import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { writingService } from '@/services/writingService';
import type { WritingSubmission } from '@/types';

export function useWritingTasks() {
  return useQuery({
    queryKey: queryKeys.writing.tasks,
    queryFn: () => writingService.listTasks(),
  });
}

export function useWritingSubmissions(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.writing.submissions(taskId ?? ''),
    queryFn: () => writingService.listSubmissions(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useMyWritingSubmission(taskId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.writing.mySubmission(taskId ?? '', studentId ?? ''),
    queryFn: () => writingService.getMySubmission(taskId!, studentId!),
    enabled: Boolean(taskId && studentId),
  });
}

export function useCreateWritingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: writingService.createTask.bind(writingService),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.writing.tasks }),
  });
}

export function useCloseWritingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => writingService.closeTask(taskId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.writing.tasks }),
  });
}

export function useReopenWritingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => writingService.reopenTask(taskId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.writing.tasks }),
  });
}

export function useSubmitWriting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof writingService.submit>[0]) =>
      writingService.submit(input),
    onSuccess: (row: WritingSubmission) => {
      void qc.invalidateQueries({ queryKey: queryKeys.writing.submissions(row.task_id) });
      void qc.invalidateQueries({
        queryKey: queryKeys.writing.mySubmission(row.task_id, row.student_id),
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
      void qc.invalidateQueries({ queryKey: queryKeys.writing.submissions(row.task_id) });
    },
  });
}
