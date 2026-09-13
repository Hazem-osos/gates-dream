'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';

export type SentinelAlertLevel = 'info' | 'warn' | 'crit';

export type SentinelAlert = {
  id: string;
  level: SentinelAlertLevel;
  text: string;
  detail?: string;
  href?: string;
};

export type SentinelAlertsData = {
  mode: 'training' | 'live';
  engineEnabled: boolean;
  alerts: SentinelAlert[];
  updatedAt: string;
};

const FALLBACK_TRAINING: SentinelAlertsData = {
  mode: 'training',
  engineEnabled: false,
  updatedAt: new Date().toISOString(),
  alerts: [
    {
      id: 'train-1',
      level: 'warn',
      text: 'بيع بأقل من متوسط التكلفة — صنف #1042 (مسودة)',
      detail:
        'مثال تدريبي: سطر فاتورة بيع بسعر أقل من التكلفة — Sentinel يطلب مراجعة قبل الترحيل.',
      href: '/inventory/operations/sales-invoice',
    },
    {
      id: 'train-2',
      level: 'info',
      text: 'خصم 18% تجاوز حد السياسة — فاتورة #SI-2401',
      detail: 'مثال تدريبي: خصم أعلى من سقف السياسة.',
    },
    {
      id: 'train-3',
      level: 'crit',
      text: 'تعديل حركة مخزنية بعد 22:00 — مستخدم admin',
      detail: 'مثال تدريبي: نشاط خارج ساعات العمل.',
      href: '/inventory/operations/issue',
    },
  ],
};

export function useSentinelAlerts() {
  const q = useApiQuery<SentinelAlertsData>(
    queryKeys.sentinelAlerts(),
    '/analytics/sentinel-alerts',
    undefined,
    { staleTime: 60_000, retry: 1 }
  );

  const data = q.data?.data ?? (q.isError ? FALLBACK_TRAINING : undefined);

  return {
    ...q,
    payload: data,
    alerts: data?.alerts ?? [],
    mode: data?.mode ?? 'training',
    engineEnabled: data?.engineEnabled ?? false,
  };
}
