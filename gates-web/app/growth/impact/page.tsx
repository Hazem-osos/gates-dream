'use client';

import Link from 'next/link';
import { money, useGrowthImpact } from '@/lib/hooks/useGrowthEngine';
import {
  CommandCenter,
  MetricBar,
  DASH_PANEL,
} from '@/components/dashboard-primitives';
import { SensitiveValue } from '@/app/components/ui/SensitiveValue';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

export default function GrowthImpactPage() {
  useBackendReachability();
  const { data, isFetching, refetch } = useGrowthImpact();
  const impact = data?.data;

  return (
    <CommandCenter
      title="أثر Gates — ما الذي تحقق فعلاً؟"
      module="GROWTH"
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[{ key: 'F8', label: 'الفرص', href: '/growth' }]}
    >
      <MetricBar
        items={[
          {
            id: 'potential',
            label: 'القيمة المحتملة',
            value: <SensitiveValue>{money(impact?.potentialValue ?? 0)} ج.م</SensitiveValue>,
            hint: 'تقديرية',
          },
          {
            id: 'actioned',
            label: 'قيمة تم اتخاذ إجراء عليها',
            value: <SensitiveValue>{money(impact?.actionedValue ?? 0)} ج.م</SensitiveValue>,
            hint: 'ليست محققة بعد',
          },
          {
            id: 'influenced',
            label: 'إيراد متأثر',
            value: <SensitiveValue>{money(impact?.influencedRevenue ?? 0)} ج.م</SensitiveValue>,
          },
          {
            id: 'cash',
            label: 'نقد مسترد',
            value: <SensitiveValue>{money(impact?.cashRecovered ?? 0)} ج.م</SensitiveValue>,
          },
          {
            id: 'inventory',
            label: 'مخزون استُردّت قيمته',
            value: <SensitiveValue>{money(impact?.inventoryRecovered ?? 0)} ج.م</SensitiveValue>,
          },
          {
            id: 'realized',
            label: 'الأثر المحقق',
            value: <SensitiveValue>{money(impact?.realizedValue ?? 0)} ج.م</SensitiveValue>,
          },
        ]}
      />

      <section className={`${DASH_PANEL} space-y-3 p-5`}>
        <h2 className="text-sm font-semibold text-slate-900">العائد التقديري</h2>
        <p className="text-sm text-slate-600">{impact?.labels.roi}</p>
        <p className="font-mono text-2xl font-bold text-[#094C6B]">
          {impact?.estimatedRoiMultiple != null ? `${impact.estimatedRoiMultiple}×` : '—'}
        </p>
        <p className="text-xs text-slate-500">{impact?.labels.influencedRevenue}</p>
        {impact?.highlights.topOpportunity ? (
          <p className="text-sm text-slate-700">
            أعلى فرصة محققة: {impact.highlights.topOpportunity.title} (
            {money(impact.highlights.topOpportunity.realizedValue)} ج.م)
          </p>
        ) : null}
      </section>

      <section className={`${DASH_PANEL} p-5`}>
        <h2 className="text-sm font-semibold text-slate-900">إسناد حديث</h2>
        {(impact?.attributions ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            لا يوجد أثر محقق بعد. سجّل إجراءً من فرصة ثم انتظر فاتورة أو تحصيل مرتبط.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {impact?.attributions.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span className="text-slate-700">{a.label}</span>
                <span className="font-mono font-semibold">{money(a.amount)} ج.م</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/growth" className="text-sm font-semibold text-[#0E78AA]">
        ← العودة للفرص
      </Link>
    </CommandCenter>
  );
}
