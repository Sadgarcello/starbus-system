import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { readingService } from '@/services/readingService';

export function useReadingBooks() {
  return useQuery({
    queryKey: queryKeys.reading.books,
    queryFn: () => readingService.listBooks(),
  });
}

export function useReadingVotes() {
  return useQuery({
    queryKey: queryKeys.reading.votes,
    queryFn: () => readingService.listVotes(),
    refetchInterval: 12_000,
  });
}

export function useCreateReadingBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: readingService.createBook.bind(readingService),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.reading.books }),
  });
}

export function useUpdateReadingProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookId,
      pagesFinished,
      totalPages,
      sessionDate,
    }: {
      bookId: string;
      pagesFinished: number;
      totalPages?: number;
      sessionDate?: string;
    }) => readingService.updateProgress(bookId, pagesFinished, totalPages, sessionDate),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.reading.books });
      void qc.invalidateQueries({ queryKey: ['student'] });
    },
  });
}

export function useDeleteReadingBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => readingService.deleteBook(bookId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.reading.books });
      void qc.invalidateQueries({ queryKey: queryKeys.reading.votes });
    },
  });
}

export function useUploadReadingCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, file }: { bookId: string; file: File }) =>
      readingService.uploadCover(bookId, file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.reading.books }),
  });
}

export function useVoteReadingBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => readingService.vote(bookId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.reading.votes }),
  });
}

export function useClearReadingVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => readingService.clearVote(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.reading.votes }),
  });
}
