import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { speakingService } from '@/services/speakingService';

export function useSpeakingFormats() {
  return useQuery({
    queryKey: queryKeys.speaking.formats,
    queryFn: () => speakingService.listFormats(),
  });
}

export function useSpeakingVotes() {
  return useQuery({
    queryKey: queryKeys.speaking.votes,
    queryFn: () => speakingService.listVotes(),
    refetchInterval: 12_000,
  });
}

export function useVoteSpeakingFormat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formatId: string) => speakingService.vote(formatId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.speaking.votes });
    },
  });
}

export function useClearSpeakingVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => speakingService.clearVote(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.speaking.votes });
    },
  });
}

export function useSpeakingDay(sessionDate: string) {
  return useQuery({
    queryKey: queryKeys.speaking.session(sessionDate),
    queryFn: () => speakingService.getSessionByDate(sessionDate),
    enabled: Boolean(sessionDate),
  });
}

export function useSpeakingMarks(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.speaking.marks(sessionId ?? ''),
    queryFn: () => speakingService.listMarks(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useMySpeakingMark(sessionId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.speaking.myMark(sessionId ?? '', studentId ?? ''),
    queryFn: () => speakingService.getMyMark(sessionId!, studentId!),
    enabled: Boolean(sessionId && studentId),
  });
}

export function useOpenSpeakingDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formatId, sessionDate }: { formatId: string; sessionDate?: string }) =>
      speakingService.openDay(formatId, sessionDate),
    onSuccess: (session) => {
      void qc.invalidateQueries({ queryKey: queryKeys.speaking.session(session.session_date) });
      void qc.invalidateQueries({ queryKey: queryKeys.speaking.formats });
    },
  });
}

export function useCloseSpeakingDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => speakingService.closeDay(sessionId),
    onSuccess: (session) => {
      void qc.invalidateQueries({ queryKey: queryKeys.speaking.session(session.session_date) });
    },
  });
}

export function useMarkSpeakingPractice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => speakingService.markPractice(sessionId),
    onSuccess: (_data, sessionId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.speaking.marks(sessionId) });
      void qc.invalidateQueries({ queryKey: ['speaking'] });
      void qc.invalidateQueries({ queryKey: ['student'] });
    },
  });
}

export function useCreateSpeakingFormat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; details: string; goal: string }) =>
      speakingService.createFormat(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.speaking.formats });
    },
  });
}

export function useDeleteSpeakingFormat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formatId: string) => speakingService.deleteFormat(formatId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.speaking.formats });
    },
  });
}
