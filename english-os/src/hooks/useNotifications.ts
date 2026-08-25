import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { showBrowserNotification } from '@/lib/browserNotify';
import { notificationService } from '@/services/notificationService';
import type { AppNotification } from '@/types';

let inboxLiveRefCount = 0;
let inboxLiveChannel: RealtimeChannel | null = null;
let inboxLiveUserId: string | null = null;

function attachInboxLive(qc: ReturnType<typeof useQueryClient>, userId: string) {
  inboxLiveRefCount += 1;

  if (inboxLiveChannel && inboxLiveUserId !== userId) {
    void supabase.removeChannel(inboxLiveChannel);
    inboxLiveChannel = null;
    inboxLiveUserId = null;
  }

  if (!inboxLiveChannel) {
    inboxLiveUserId = userId;
    inboxLiveChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as AppNotification | undefined;
          if (row?.title) {
            showBrowserNotification(row.title, row.body, row.id);
          }
          void qc.invalidateQueries({ queryKey: queryKeys.notifications.inbox });
          void qc.invalidateQueries({ queryKey: queryKeys.notifications.unread });
        },
      )
      .subscribe();
  }

  return () => {
    inboxLiveRefCount = Math.max(0, inboxLiveRefCount - 1);
    if (inboxLiveRefCount === 0 && inboxLiveChannel) {
      void supabase.removeChannel(inboxLiveChannel);
      inboxLiveChannel = null;
      inboxLiveUserId = null;
    }
  };
}

export function useNotifications(userId?: string, enabled = true) {
  const qc = useQueryClient();
  const active = enabled && Boolean(userId);

  const inbox = useQuery({
    queryKey: queryKeys.notifications.inbox,
    queryFn: () => notificationService.list(),
    enabled: active,
    refetchInterval: active ? 5_000 : false,
  });

  const unread = useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: () => notificationService.unreadCount(),
    enabled: active,
    refetchInterval: active ? 5_000 : false,
  });

  useEffect(() => {
    if (!active || !userId) return;
    return attachInboxLive(qc, userId);
  }, [active, userId, qc]);

  const markRead = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.inbox });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.unread });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.inbox });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.unread });
    },
  });

  return {
    inbox,
    unreadCount: unread.data ?? 0,
    markRead,
    markAllRead,
  };
}
