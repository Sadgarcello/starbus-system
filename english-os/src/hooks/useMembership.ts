import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { membershipService } from '@/services/membershipService';
import type { UserRole } from '@/types';

/** One shared realtime channel — AppLayout + ApprovalsPage both use this hook. */
let pendingLiveRefCount = 0;
let pendingLiveChannel: RealtimeChannel | null = null;

function attachPendingLive(qc: QueryClient) {
  pendingLiveRefCount += 1;
  if (!pendingLiveChannel) {
    pendingLiveChannel = supabase
      .channel('pending-approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.membership.pending });
          void qc.invalidateQueries({ queryKey: queryKeys.membership.students });
        },
      )
      .subscribe();
  }

  return () => {
    pendingLiveRefCount = Math.max(0, pendingLiveRefCount - 1);
    if (pendingLiveRefCount === 0 && pendingLiveChannel) {
      void supabase.removeChannel(pendingLiveChannel);
      pendingLiveChannel = null;
    }
  };
}

/** Shared so only one browser notification fires even with multiple hook users. */
let lastNotifiedPendingCount: number | null = null;

export function usePendingMembers(enabled = true) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.membership.pending,
    queryFn: () => membershipService.listPending(),
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });

  useEffect(() => {
    if (!enabled) return;
    return attachPendingLive(qc);
  }, [enabled, qc]);

  useEffect(() => {
    if (!enabled || query.data === undefined) return;
    const count = query.data.length;
    if (lastNotifiedPendingCount !== null && count > lastNotifiedPendingCount) {
      const newest = query.data[query.data.length - 1];
      const label = newest?.name || newest?.email || 'A student';
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          new Notification('Khawaja Club — new request', {
            body: `${label} asked to join. Open Approvals.`,
          });
        } else if (Notification.permission === 'default') {
          void Notification.requestPermission().then((perm) => {
            if (perm === 'granted') {
              new Notification('Khawaja Club — new request', {
                body: `${label} asked to join. Open Approvals.`,
              });
            }
          });
        }
      }
    }
    lastNotifiedPendingCount = count;
  }, [enabled, query.data]);

  return query;
}

export function useActiveStudents(enabled = true) {
  return useQuery({
    queryKey: queryKeys.membership.students,
    queryFn: () => membershipService.listStudents(),
    enabled,
  });
}

export function useApproveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      membershipService.approve(userId, role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.membership.pending });
      void qc.invalidateQueries({ queryKey: queryKeys.membership.students });
    },
  });
}

export function useRejectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => membershipService.reject(userId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.membership.pending }),
  });
}

export function useSetMemberLocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, locked }: { userId: string; locked: boolean }) =>
      membershipService.setLocked(userId, locked),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.membership.students }),
  });
}
