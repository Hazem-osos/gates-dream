'use client';

import Link from 'next/link';
import { FixedAssetsPage, StatCard } from '@/components/fixed-assets/shared';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { formatDay, formatMoney } from '@/lib/fixed-assets/types';

type Summary = {
  byStatus: Record<string, { count: number; cost: number; accumulated: number; bookValue: number }>;
  inService: { count: number; cost: number; accumulated: number; bookValue: number };
  lastRun: { runNumber: string; periodEnd: string; totalAmount: number } | null;
};

const LINKS = [
  { href: '/fixed-assets/categories', title: 'فئات الأصول', text: 'عرّف المجموعات (مباني، سيارات، أجهزة…) وحساباتها وطريقة وعمر الإهلاك.' },
  { href: '/fixed-assets/assets/new', title: 'إضافة أصل', text: 'سجّل أصلًا جديدًا أو أصلًا موجودًا قبل بدء العمل على البرنامج.' },
  { href: '/fixed-assets/assets', title: 'سجل الأصول', text: 'كل الأصول بالتكلفة ومجمع الإهلاك وصافي القيمة الدفترية.' },
  { href: '/fixed-assets/depreciation', title: 'الإهلاك الشهري', text: 'احسب إهلاك الشهر وراجعه ثم رحّله في قيد واحد.' },
  { href: '/fixed-assets/disposals', title: 'بيع واستبعاد الأصول', text: 'بيع أصل أو تكهينه مع حساب الربح أو الخسارة تلقائيًا.' },
  { href: '/fixed-assets/reports/movement', title: 'تقرير حركة الأصول', text: 'جدول الحركة لكل فئة كما يطلبه إيضاح القوائم المالية.' },
];

export default function FixedAssetsHomePage() {
  const { data } = useApiQuery<Summary>(queryKeys.fixedAssets.summary(), '/fixed-assets/assets/summary', undefined, {
    staleTime: 0,
  });
  const s = data?.data;
  const drafts = s?.byStatus?.DRAFT?.count ?? 0;
  const disposed = s?.byStatus?.DISPOSED?.count ?? 0;

  return (
    <FixedAssetsPage
      title="الأصول الثابتة"
      description="سجل الأصول وإهلاكها الشهري وبيعها واستبعادها — وفق معيار المحاسبة المصري رقم 10"
      crumb={[]}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="أصول في الخدمة" value={String(s?.inService.count ?? 0)} hint={`${drafts} مسودة · ${disposed} مستبعد`} />
        <StatCard label="إجمالي التكلفة" value={formatMoney(s?.inService.cost)} />
        <StatCard label="مجمع الإهلاك" value={formatMoney(s?.inService.accumulated)} />
        <StatCard
          label="صافي القيمة الدفترية"
          value={formatMoney(s?.inService.bookValue)}
          hint={s?.lastRun ? `آخر إهلاك: ${formatDay(s.lastRun.periodEnd)} (رقم ${s.lastRun.runNumber})` : 'لم يُرحل إهلاك بعد'}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-border bg-surface-1 p-4 shadow-sm transition-colors hover:border-brand"
          >
            <div className="font-bold text-brand">{link.title}</div>
            <p className="mt-1 text-sm text-foreground-muted">{link.text}</p>
          </Link>
        ))}
      </div>
    </FixedAssetsPage>
  );
}
