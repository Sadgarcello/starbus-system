import { supabase } from '@/lib/supabase';
import type {
  AppNotification,
  NotificationTestResult,
  NotificationTestScenario,
  PushDispatchStatus,
} from '@/types';

export const notificationService = {
  async list(limit = 50): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AppNotification[];
  },

  async unreadCount(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null);
    if (error) throw error;
    return count ?? 0;
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);
    if (error) throw error;
  },

  async markAllRead(): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
    if (error) throw error;
  },

  async pushDispatchStatus(): Promise<PushDispatchStatus> {
    const { data, error } = await supabase.rpc('admin_push_dispatch_status');
    if (error) throw error;
    return data as PushDispatchStatus;
  },

  async sendTest(scenario: NotificationTestScenario): Promise<NotificationTestResult> {
    const { data, error } = await supabase.rpc('admin_send_test_notification', {
      p_scenario: scenario,
    });
    if (error) throw error;
    return data as NotificationTestResult;
  },

  async sendAllTests(): Promise<{ total_sent: number; results: NotificationTestResult[] }> {
    const { data, error } = await supabase.rpc('admin_send_all_test_notifications');
    if (error) throw error;
    const payload = data as { total_sent: number; results: NotificationTestResult[] };
    return {
      total_sent: payload.total_sent ?? 0,
      results: payload.results ?? [],
    };
  },

  /** Direct push to this admin's registered devices — bypasses Supabase pg_net. */
  async pushThisDevice(): Promise<{
    sent: number;
    failed: number;
    errors?: string[];
    skipped?: string;
    hint?: string;
    subscription_count?: number;
  }> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    let accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      accessToken = refreshed.session?.access_token;
      if (!accessToken) {
        throw new Error(
          refreshError?.message || sessionError?.message || 'Not signed in — sign out and sign in again.',
        );
      }
    }

    const res = await fetch('/api/push-this-device', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const detail = body.detail ? ` (${String(body.detail)})` : '';
      throw new Error(`${String(body.error ?? 'Push test failed')}${detail}`);
    }
    return body as {
      sent: number;
      failed: number;
      errors?: string[];
      skipped?: string;
      hint?: string;
      subscription_count?: number;
    };
  },
};
