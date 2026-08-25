import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { listeningService } from '@/services/listeningService';

export function useListeningPicks() {
  return useQuery({
    queryKey: queryKeys.listening.picks,
    queryFn: () => listeningService.listPicks(),
  });
}

export function useSubmitListeningPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: listeningService.submitPick,
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.listening.picks }),
  });
}

export function useDeleteListeningPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pickId: string) => listeningService.deletePick(pickId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.listening.picks }),
  });
}
