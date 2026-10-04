'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { BarChart3, FileSpreadsheet, LayoutDashboard, TrendingUp, Users, Wrench } from 'lucide-react';
import { ReportPageShell } from '@/components/erp/ReportPageHeader';
import { useApiQuery } from '@/lib/hooks/useApi';
import { cn } from '@/lib/utils';

type CatalogResponse = {
  groups: Record<string, { titleAr: string; descriptionAr: string }>;
  reports: Array<{
    key: string;
    nameAr: string;
    descriptionAr: string;
    groupId: string;
    legacy?: boolean;
  }>;
};

const GROUP_ICON: Record<string, typeof BarChart3> = {
  management: LayoutDashboard,
  contracts: FileSpreadsheet,
  certificates: Users,
  cost_profit: TrendingUp,
  subcontractors: Wrench,
  execution: BarChart3,
  tenders: FileSpreadsheet,
  financial: TrendingUp,
};

export default function ContractingReportsHubPage() {
  const q = useApiQuery<CatalogResponse>(['contracting-reports-catalog'], '/contracting/reports/catalog');
  const catalog = q.data?.data;

  const grouped = useMemo(() => {
    if (!catalog) return [];
    return Object.entries(catalog.groups).map(([id, meta]) => ({
      id,
      ...meta,
      reports: catalog.reports.filter((r) => r.groupId === id && r.key !== 'evm-legacy'),
    }));
  }, [catalog]);

  return (
    <ReportPageShell
      title="تقارير المقاولات"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'التقارير' },
      ]}
      extraActions={
        <Link
          href="/contracting/reports/management-dashboard"
          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white"
        >
          لوحة الإدارة
        </Link>
      }
    >
      {q.isLoading ? <p className="text-sm text-muted-foreground">جاري تحميل فهرس التقارير…</p> : null}
      {q.isError ? (
        <p className="text-sm text-destructive">تعذر تحميل التقارير. تحقق من الاتصال والصلاحيات.</p>
      ) : null}
      <div className="space-y-8">
        {grouped.map((group) => {
          const Icon = GROUP_ICON[group.id] ?? BarChart3;
          return (
            <section key={group.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-brand" />
                <div>
                  <h2 className="text-lg font-bold text-brand">{group.titleAr}</h2>
                  <p className="text-xs text-muted-foreground">{group.descriptionAr}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.reports.map((report) => (
                  <Link
                    key={report.key}
                    href={`/contracting/reports/${report.key}`}
                    className={cn(
                      'rounded-2xl border bg-surface-1 p-4 shadow-sm transition-colors hover:border-brand hover:bg-[var(--info-soft)]',
                      report.legacy && 'opacity-75'
                    )}
                  >
                    <h3 className="font-bold text-[#094C6B]">{report.nameAr}</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{report.descriptionAr}</p>
                    {report.legacy ? (
                      <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        أرشيف
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
        <section className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-bold text-brand">EVM (أرشيف)</p>
          <p className="mt-1">
            تقرير القيمة المكتسبة القديم متاح من{' '}
            <Link href="/contracting/projects" className="text-brand underline">
              مساحة المشروع → EVM (أرشيف)
            </Link>
            . التقارير الجديدة تستخدم P3/P2-2.
          </p>
        </section>
      </div>
    </ReportPageShell>
  );
}
