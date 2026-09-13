'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { askGatesAi } from '@/lib/ai/ask-screen-help';
import { apiClient } from '@/lib/api/client';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import {
  money,
  useGrowthOverview,
  useGrowthRefresh,
  type GrowthOpportunity,
} from '@/lib/hooks/useGrowthEngine';
import { GrowthOpportunityDrawer } from '@/components/growth/GrowthOpportunityDrawer';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DASH_PANEL,
  HUD_SEGMENT,
  HUD_SEGMENT_OFF,
  HUD_SEGMENT_ON,
} from '@/components/dashboard-primitives';
import { SensitiveValue } from '@/app/components/ui/SensitiveValue';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

const FILTERS = [
  { id: 'ALL', label: 'الكل' },
  { id: 'REVENUE', label: 'إيراد' },
  { id: 'CASH_RECOVERY', label: 'تحصيل' },
  { id: 'INVENTORY', label: 'مخزون' },
  { id: 'PRICING', label: 'تسعير' },
  { id: 'CUSTOMERS', label: 'عملاء' },
  { id: 'COSTS', label: 'تكاليف' },
  { id: 'HIGH', label: 'أولوية عالية' },
  { id: 'RECENT', label: 'حديثة' },
  { id: 'ACTION_TAKEN', label: 'تم اتخاذ إجراء' },
  { id: 'WON', label: 'مكتمل' },
  { id: 'DISMISSED', label: 'مستبعد' },
] as const;

function toneFor(priority: string): 'bad' | 'warn' | 'info' {
  if (priority === 'CRITICAL') return 'bad';
  if (priority === 'HIGH') return 'warn';
  return 'info';
}

export default function GrowthPage() {
  useBackendReachability();
  const { data, isLoading, isFetching } = useGrowthOverview();
  const refresh = useGrowthRefresh();
  const invalidate = useInvalidateQuery();
  const overview = data?.data;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('ALL');
  const [selected, setSelected] = useState<GrowthOpportunity | null>(null);
  const [busy, setBusy] = useState(false);

  const opportunities = overview?.opportunities ?? [];
  const visible = useMemo(() => {
    return opportunities.filter((o) => {
      if (filter === 'ALL') return !['DISMISSED', 'WON', 'LOST'].includes(o.status);
      if (filter === 'HIGH') return o.priority === 'HIGH' || o.priority === 'CRITICAL';
      if (filter === 'RECENT') {
        return Date.now() - new Date(o.createdAt).getTime() < 7 * 86_400_000;
      }
      if (filter === 'ACTION_TAKEN' || filter === 'WON' || filter === 'DISMISSED') return o.status === filter;
      if (filter === 'CUSTOMERS') return o.category === 'CUSTOMERS' || o.category === 'REVENUE' || o.entityType === 'customer';
      return o.category === filter;
    });
  }, [opportunities, filter]);

  const runAction = async (key: string, label: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      if (key === 'dismiss') {
        await apiClient.post(`/growth/${selected.id}/dismiss`, {});
      } else if (key === 'ask-ai') {
        askGatesAi(
          `فرصة نمو: ${selected.title}. القيمة المحتملة ${selected.estimatedValue} ج.م. السبب: ${selected.whyDetected}. اقترح استراتيجية تنفيذ عملية دون اختراع أرقام.`
        );
        return;
      } else {
        await apiClient.post(`/growth/${selected.id}/actions`, { actionKey: key, label });
      }
      invalidate(['growth']);
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommandCenter
      title="النمو — أين يمكن تحقيق أو استرداد أموال؟"
      module="GROWTH"
      refreshing={isFetching || refresh.isPending}
      onRefresh={() => refresh.mutate({})}
      shortcuts={[
        { key: 'F8', label: 'الأثر', href: '/growth/impact' },
        { key: 'F9', label: 'المشخّص', href: '/diagnostic' },
        { key: 'F2', label: 'الإدارة العليا', href: '/executive' },
      ]}
      filters={
        <div className={HUD_SEGMENT} role="group" aria-label="تصفية الفرص">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={filter === f.id ? HUD_SEGMENT_ON : HUD_SEGMENT_OFF}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      <MetricBar
        items={[
          {
            id: 'potential',
            label: 'القيمة المحتملة',
            value: <SensitiveValue>{money(overview?.potentialValue ?? 0)} ج.م</SensitiveValue>,
            hint: 'تقديرية — ليست محققة',
          },
          {
            id: 'revenue',
            label: 'إيراد',
            value: <SensitiveValue>{money(overview?.breakdown.revenue ?? 0)}</SensitiveValue>,
          },
          {
            id: 'cash',
            label: 'تحصيل نقدي',
            value: <SensitiveValue>{money(overview?.breakdown.cashRecovery ?? 0)}</SensitiveValue>,
          },
          {
            id: 'inventory',
            label: 'مخزون',
            value: <SensitiveValue>{money(overview?.breakdown.inventory ?? 0)}</SensitiveValue>,
          },
          {
            id: 'savings',
            label: 'توفير',
            value: <SensitiveValue>{money(overview?.breakdown.savings ?? 0)}</SensitiveValue>,
          },
        ]}
      />

      {overview?.empty ? (
        <section className={`${DASH_PANEL} p-6`}>
          <h2 className="text-base font-semibold text-slate-900">لا توجد فرص موثوقة بعد</h2>
          <p className="mt-2 text-sm text-slate-600">{overview.emptyReason}</p>
          {overview.missingData.length ? (
            <ul className="mt-3 list-disc pr-5 text-sm text-slate-500">
              {overview.missingData.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-[#0E78AA]"
            onClick={() => refresh.mutate({})}
          >
            تشغيل التحليل الآن
          </button>
        </section>
      ) : (
        <TriageQueue
          title="الفرص الأعلى أثراً"
          loading={isLoading}
          empty="لا توجد فرص ضمن هذا التصفية"
          items={visible.slice(0, 40).map((o) => ({
            id: o.id,
            title: o.title,
            meta: o.description,
            amount: <SensitiveValue>{money(o.estimatedValue)} ج.م</SensitiveValue>,
            tone: toneFor(o.priority),
            actions: [
              {
                label: 'التفاصيل',
                onClick: () => {
                  setSelected(o);
                  void (async () => {
                    const detail = await apiClient.get<GrowthOpportunity>(`/growth/${o.id}`);
                    if (detail.data) setSelected(detail.data);
                    if (o.status === 'NEW') {
                      await apiClient.post(`/growth/${o.id}/review`, {});
                    }
                  })();
                },
              },
            ],
          }))}
        />
      )}

      <div className="flex justify-end">
        <Link href="/growth/impact" className="text-sm font-semibold text-[#0E78AA]">
          أثر Gates المقاس →
        </Link>
      </div>

      <GrowthOpportunityDrawer
        opportunity={selected}
        onClose={() => setSelected(null)}
        onAction={runAction}
        busy={busy}
      />
    </CommandCenter>
  );
}
