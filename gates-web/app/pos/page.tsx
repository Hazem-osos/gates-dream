'use client';

import Link from 'next/link';
import { CalendarDays, ShoppingCart, Store, Wallet } from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { KpiSummaryCard, ModuleKpiGrid, PageHeader } from '@/components/ui';

export default function POSPage() {
  useBackendReachability();

  return (
    <div className="min-h-screen bg-white p-6" dir="rtl">
      <PageHeader
        title="نقاط البيع"
        description="الوردية، الكتالوج السريع، ويومية التحصيل"
        breadcrumbs={[{ label: 'نقاط البيع' }]}
      />
      <ModuleKpiGrid>
        <KpiSummaryCard label="نقطة البيع السريعة" value="POS" icon={ShoppingCart} trend="F2 / F4 / F9" />
        <KpiSummaryCard label="اليومية" value="—" icon={CalendarDays} hint="ملخص مبيعات اليوم" />
        <KpiSummaryCard label="الفروع / المخازن" value="—" icon={Store} />
        <KpiSummaryCard label="تحصيل الوردية" value="—" icon={Wallet} />
      </ModuleKpiGrid>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link
          href="/pos/point-of-sale"
          className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-[#0E79AA]"
        >
          <h2 className="font-bold text-slate-900">نقطة البيع السريعة</h2>
          <p className="mt-1 text-sm text-slate-600">مسح باركود، كتالوج، وسداد فوري</p>
        </Link>
        <Link href="/pos/daily" className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-[#0E79AA]">
          <h2 className="font-bold text-slate-900">يومية نقاط البيع</h2>
          <p className="mt-1 text-sm text-slate-600">مراجعة التحصيل حسب التاريخ والفرع</p>
        </Link>
      </div>
    </div>
  );
}
