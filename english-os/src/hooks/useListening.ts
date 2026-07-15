import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listeningService } from '@/services/listeningService';

export const listeningKeys = {
  picks: ['listening', 'picks'] as const,
};

export function useListeningPicks() {
  return useQuery({
    queryKey: listeningKeys.picks,
    queryFn: () => listeningService.listPicks(),
  });
}

export function useSubmitListeningPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: listeningService.submitPick,
    onSuccess: () => void qc.invalidateQueries({ queryKey: listeningKeys.picks }),
  });
}

export function useDeleteListeningPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pickId: string) => listeningService.deletePick(pickId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: listeningKeys.picks }),
  });
}
