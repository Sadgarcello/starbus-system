import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { hobbyService } from '@/services/hobbyService';

export function useHobbyCatalog() {
  return useQuery({
    queryKey: queryKeys.hobbies.catalog,
    queryFn: () => hobbyService.listCatalog(),
  });
}

export function useStudentHobbies(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hobbies.student(studentId ?? ''),
    queryFn: () => hobbyService.listForStudent(studentId!),
    enabled: Boolean(studentId),
  });
}

export function useMyPendingHobbySuggestions(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hobbies.pendingMine(studentId ?? ''),
    queryFn: () => hobbyService.listMyPendingSuggestions(studentId!),
    enabled: Boolean(studentId),
  });
}

export function usePendingHobbySuggestions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.hobbies.pendingAdmin,
    queryFn: () => hobbyService.listPendingSuggestions(),
    enabled,
    refetchInterval: enabled ? 20_000 : false,
  });
}

export function useRequestHobby() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rawInterest: string) => hobbyService.requestOrAdd(rawInterest),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hobbies'] });
      void qc.invalidateQueries({ queryKey: queryKeys.hobbies.pendingAdmin });
    },
  });
}

export function useAddHobby() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, hobbyId }: { studentId: string; hobbyId: string }) =>
      hobbyService.addExisting(studentId, hobbyId),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.hobbies.student(vars.studentId) });
    },
  });
}

export function useRemoveHobby() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, hobbyId }: { studentId: string; hobbyId: string }) =>
      hobbyService.remove(studentId, hobbyId),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.hobbies.student(vars.studentId) });
    },
  });
}

export function useNormalizeHobby() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      suggestionId,
      canonicalName,
    }: {
      suggestionId: string;
      canonicalName: string;
    }) => hobbyService.normalize(suggestionId, canonicalName),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hobbies'] });
    },
  });
}

export function useRejectHobbySuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) => hobbyService.rejectSuggestion(suggestionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hobbies.pendingAdmin });
    },
  });
}
