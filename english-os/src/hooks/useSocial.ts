import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { socialService } from '@/services/socialService';

export function useSocialProfiles() {
  return useQuery({
    queryKey: queryKeys.social.profiles,
    queryFn: () => socialService.listProfiles(),
  });
}
