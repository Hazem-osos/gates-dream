'use client';

import Link from 'next/link';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ReportPageShell } from '@/components/erp/ReportPageHeader';

const REPORT_LINKS: { href: string; label: string }[] = [
  { href: '/hr/employee-data-report', label: 'تقرير بيانات الموظفين' },
  { href: '/hr/employee-secondment-report', label: 'تقرير إنتداب الموظفين' },
  { href: '/hr/employee-penalties-report', label: 'تقرير جزاءات الموظفين' },
  { href: '/hr/employee-rewards-report', label: 'تقرير مكافآت الموظفين' },
  { href: '/hr/employee-warnings-report', label: 'تقرير إنذارات الموظفين' },
  { href: '/hr/employee-courses-report', label: 'تقرير دورات الموظفين' },
  { href: '/hr/employee-transfer-report', label: 'تقرير نقل الموظفين' },
  { href: '/hr/employee-promotions-report', label: 'تقرير ترقيات الموظفين' },
  { href: '/hr/employee-suspensions-report', label: 'تقرير إيقافات الموظفين' },
  { href: '/hr/employee-termination-report', label: 'تقرير إنهاء خدمات الموظفين' },
  { href: '/hr/employee-loans-report', label: 'تقرير سلف الموظفين' },
  { href: '/hr/housing-allowance-report', label: 'تقرير بدل السكن' },
  { href: '/hr/leave-entitlements-report', label: 'تقرير مستحقات الإجازات' },
  { href: '/hr/end-of-service-report', label: 'تقرير نهاية الخدمة' },
  { href: '/hr/employee-recommendations-report', label: 'تقرير توصيات الموظفين' },
];

export default function HrReportsHubPage() {
  useBackendReachability();

  return (
    <ReportPageShell
      title="تقارير الموظفين"
      breadcrumbs={[
        { label: 'الموارد البشرية', href: '/hr' },
        { label: 'تقارير الموظفين' },
      ]}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {REPORT_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#0B6A96]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </ReportPageShell>
  );
}
