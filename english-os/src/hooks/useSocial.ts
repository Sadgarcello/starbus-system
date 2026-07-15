import { useQuery } from '@tanstack/react-query';
import { socialService } from '@/services/socialService';

export function useSocialProfiles() {
  return useQuery({
    queryKey: ['social', 'profiles'],
    queryFn: () => socialService.listProfiles(),
  });
}
