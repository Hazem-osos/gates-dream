'use client';

import Link from 'next/link';
import { useApiQuery } from '@/lib/hooks/useApi';

type DemoSeedStatus = {
  active: boolean;
  marker: string;
  projectCodes: string[];
  portfolioPreview?: {
    activeProjects?: number;
    revisedContractValue?: number;
    forecastProfit?: number;
  };
};

export function ContractingRailwayDemoBar() {
  const q = useApiQuery<DemoSeedStatus>(
    ['contracting-demo-seed-status'],
    '/contracting/dashboard/demo-seed-status',
    undefined,
    { staleTime: 120_000, retry: 1 }
  );
  const data = q.data?.data;
  if (!data?.active) return null;

  return (
    <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">بيانات تجريبية Railway — {data.marker}</p>
          <p className="text-xs opacity-90">
            المشاريع: {data.projectCodes.join(' · ')} — التقارير والصفحات تعرض أرقام حقيقية من P1/P2/P3
          </p>
          {data.portfolioPreview ? (
            <p className="mt-1 text-xs tabular-nums">
              محفظة: {data.portfolioPreview.activeProjects ?? 0} مشروع — عقود{' '}
              {Number(data.portfolioPreview.revisedContractValue ?? 0).toLocaleString('ar-EG')} — ربح متوقع{' '}
              {Number(data.portfolioPreview.forecastProfit ?? 0).toLocaleString('ar-EG')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/contracting/reports/management-dashboard"
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white"
          >
            لوحة التقارير
          </Link>
          <Link
            href="/contracting/reports"
            className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs font-bold text-emerald-900"
          >
            كل التقارير
          </Link>
          <Link
            href="/contracting/projects"
            className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs font-bold text-emerald-900"
          >
            المشاريع
          </Link>
        </div>
      </div>
    </div>
  );
}
