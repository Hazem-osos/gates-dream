'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CalendarDays, ShoppingCart, Store, Wallet } from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import { KpiSummaryCard, ModuleKpiGrid, PageHeader } from '@/components/ui';
import { SegmentedBar } from '@/components/dashboard-primitives';
import { toFiniteNumber } from '@/components/dashboard';

type VarianceReadiness = {
  shortageConfigured: boolean;
  surplusConfigured: boolean;
};

type PosSale = {
  paidAmount?: number | string | null;
  remainingAmount?: number | string | null;
  netAmount?: number | string | null;
};

export default function POSPage() {
  useBackendReachability();
  const readinessQ = useApiQuery<VarianceReadiness>(
    ['pos-variance-readiness'],
    '/pos/shifts/readiness',
    {},
    { staleTime: 30_000, skipErrorNotify: true }
  );
  const salesQ = useApiQuery<PosSale[]>(
    ['pos-hub-orders'],
    '/pos/orders',
    { limit: 50 },
    { staleTime: 0, skipErrorNotify: true }
  );
  const split = useMemo(() => {
    const rows = salesQ.data?.data ?? [];
    return rows.reduce(
      (sum, row) => {
        sum.paid += toFiniteNumber(row.paidAmount);
        sum.open += toFiniteNumber(row.remainingAmount);
        sum.net += toFiniteNumber(row.netAmount);
        sum.count += 1;
        return sum;
      },
      { paid: 0, open: 0, net: 0, count: 0 }
    );
  }, [salesQ.data?.data]);

  return (
    <div className="min-h-screen bg-white p-6" dir="rtl">
      <PageHeader
        title="نقاط البيع"
        description="الوردية، الكتالوج السريع، ويومية التحصيل"
        breadcrumbs={[{ label: 'نقاط البيع' }]}
      />
      {readinessQ.data?.data &&
      (!readinessQ.data.data.shortageConfigured || !readinessQ.data.data.surplusConfigured) ? (
        <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          حساب{' '}
          {!readinessQ.data.data.shortageConfigured ? 'العجز النقدي' : ''}
          {!readinessQ.data.data.shortageConfigured && !readinessQ.data.data.surplusConfigured
            ? ' و'
            : ''}
          {!readinessQ.data.data.surplusConfigured ? 'الزيادة النقدية' : ''}{' '}
          غير مضبوط. إقفال وردية بفرق نقدي سيتوقف حتى يُضبط من إعدادات الحسابات. الإقفال بدون فرق يبقى متاحاً.
        </p>
      ) : null}
      <ModuleKpiGrid>
        <KpiSummaryCard
          label="عمليات مرحلة"
          value={String(split.count)}
          icon={ShoppingCart}
          hint="آخر ٥٠ أمر نقطة بيع مرحّل"
        />
        <KpiSummaryCard
          label="صافي آخر العمليات"
          value={split.net.toFixed(2)}
          icon={CalendarDays}
          hint="من أوامر نقطة البيع المرحلة، وليس فواتير المبيعات"
        />
        <KpiSummaryCard label="الفروع / المخازن" value="—" icon={Store} />
        <KpiSummaryCard
          label="محصّل نقداً وبطاقة"
          value={split.paid.toFixed(2)}
          icon={Wallet}
          hint="الآجل يظهر كمتبقي"
        />
      </ModuleKpiGrid>
      <section className="mb-4 rounded-xl border border-[#D6EAF3] bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-[#094C6B]">آخر المبيعات المرحلة</p>
        <SegmentedBar
          segments={
            split.paid > 0 || split.open > 0
              ? [
                  { label: 'محصّل', value: split.paid, color: '#059669' },
                  { label: 'متبقي', value: split.open, color: '#E3A008' },
                ]
              : [{ label: 'صافي المبيعات', value: split.net, color: '#0E78AA' }]
          }
        />
        <p className="mt-2 text-xs text-slate-500">
          من آخر ٥٠ أمر نقطة بيع مرحّل. فواتير المبيعات التاريخية من المسار القديم لا تُدمج هنا لأنه لا يوجد ما يميزها عن فاتورة بيع عادية.
        </p>
      </section>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link
          href="/pos/point-of-sale"
          className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-[#0E78AA]"
        >
          <h2 className="font-bold text-slate-900">نقطة البيع السريعة</h2>
          <p className="mt-1 text-sm text-slate-600">مسح باركود، كتالوج، وسداد فوري</p>
        </Link>
        <Link href="/pos/commercial" className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-[#0E78AA]">
          <h2 className="font-bold text-slate-900">عروض السعر والاستبدال</h2>
          <p className="mt-1 text-sm text-slate-600">عرض سعر، استبدال، كوبون، بطاقة هدية، وعربون</p>
        </Link>
        <Link href="/pos/returns" className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-[#0E78AA]">
          <h2 className="font-bold text-slate-900">مرتجع</h2>
          <p className="mt-1 text-sm text-slate-600">بحث عن إيصال ومرتجع كلي أو جزئي</p>
        </Link>
        <Link href="/pos/session" className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-[#0E78AA]">
          <h2 className="font-bold text-slate-900">الدرج وإقفال الوردية</h2>
          <p className="mt-1 text-sm text-slate-600">نقدية داخلة وخارجة، والجرد المتوقع مقابل المعدود</p>
        </Link>
        <Link href="/pos/settings" className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-[#0E78AA]">
          <h2 className="font-bold text-slate-900">إعدادات نقطة البيع</h2>
          <p className="mt-1 text-sm text-slate-600">سياسة العجز وطرق الدفع</p>
        </Link>
        <Link href="/pos/reports" className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-[#0E78AA]">
          <h2 className="font-bold text-slate-900">تقارير نقطة البيع</h2>
          <p className="mt-1 text-sm text-slate-600">كاشير، صنف، تصنيف، طريقة دفع، مرتجع، ووردية</p>
        </Link>
        <Link href="/pos/daily" className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-[#0E78AA]">
          <h2 className="font-bold text-slate-900">يومية نقاط البيع</h2>
          <p className="mt-1 text-sm text-slate-600">مراجعة التحصيل حسب التاريخ والفرع</p>
        </Link>
      </div>
    </div>
  );
}
