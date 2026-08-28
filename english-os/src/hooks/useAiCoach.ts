import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { aiCoachService } from '@/services/aiCoachService';
import type { AiTextSourceType } from '@/types';

export function useAiEvaluation(sourceType: AiTextSourceType, sourceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.aiCoach.evaluation(sourceType, sourceId ?? ''),
    queryFn: () => aiCoachService.getEvaluation(sourceType, sourceId!),
    enabled: Boolean(sourceId),
  });
}

export function useEvaluateText(sourceType: AiTextSourceType, sourceId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (force?: boolean) =>
      aiCoachService.evaluateText({
        sourceType,
        sourceId: sourceId!,
        force,
      }),
    onSuccess: () => {
      if (sourceId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.aiCoach.evaluation(sourceType, sourceId),
        });
      }
    },
  });
}
