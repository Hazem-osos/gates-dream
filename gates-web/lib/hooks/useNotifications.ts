import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useApiMutation, useApiQuery, useInvalidateQuery } from './useApi';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface SystemNotification {
  id: string;
  source?: 'ai' | 'system';
  title: string;
  message: string;
  titleAr?: string;
  messageAr?: string;
  type: string;
  category: string | null;
  severity?: NotificationSeverity;
  linkUrl: string | null;
  actionUrl?: string | null;
  actionLabelAr?: string | null;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications(limit = 20) {
  const invalidate = useInvalidateQuery();
  const queryClient = useQueryClient();

  const query = useApiQuery<SystemNotification[]>(
    ['notifications', String(limit)],
    '/notifications',
    { limit },
    {
      refetchInterval: (q) => (q.state.status === 'error' ? false : 20_000),
      refetchOnWindowFocus: true,
      retry: false,
    }
  );

  const raw = query.data;
  const items = raw?.data ?? [];
  const unreadCount = raw?.meta?.unreadCount ?? items.filter((n) => !n.isRead).length;
  const hasCriticalUnread =
    Boolean(raw?.meta?.hasCriticalUnread) ||
    items.some((n) => !n.isRead && (n.severity === 'CRITICAL' || n.type === 'CRITICAL' || n.type === 'ALERT'));

  useEffect(() => {
    let cancelled = false;
    const token =
      typeof window === 'undefined'
        ? null
        : localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) return undefined;

    const connect = async () => {
      try {
        const res = await fetch('/api/v1/notifications/stream', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        });
        if (!res.ok || !res.body || cancelled) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.includes('event: snapshot')) {
            buffer = '';
            await queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        }
      } catch {
        /* polling fallback stays active */
      }
    };

    void connect();
    const timer = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }, 45_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [queryClient]);

  const markAll = useApiMutation<{ updated: number }, Record<string, never>>(
    '/notifications/mark-all-read',
    'POST',
    {
      onSuccess: () => invalidate(['notifications']),
    }
  );

  const markRead = useCallback(
    async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`, {});
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    [queryClient]
  );

  return {
    items,
    unreadCount,
    hasCriticalUnread,
    isLoading: query.isLoading,
    refetch: query.refetch,
    markRead,
    markAllRead: () => markAll.mutate({}),
    markAllPending: markAll.isPending,
  };
}
