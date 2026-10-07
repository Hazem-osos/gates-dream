'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/hr/payroll/dashboard', label: 'لوحة الرواتب' },
  { href: '/hr/payroll/runs', label: 'مسيرات الرواتب' },
  { href: '/hr/payroll/inputs', label: 'مدخلات لمرة واحدة' },
  { href: '/hr/payroll/components', label: 'مكونات الراتب' },
  { href: '/hr/payroll/compensation', label: 'تعويضات الموظف' },
  { href: '/hr/payroll/rules', label: 'قواعد الرواتب' },
  { href: '/hr/payroll/localization', label: 'التوطين' },
  { href: '/hr/payroll/gl-mapping', label: 'ربط GL' },
  { href: '/hr/payroll/reports', label: 'التقارير' },
];

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen" dir="rtl">
      <header className="border-b bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-lg font-bold">عمليات الرواتب (HCM)</h1>
          <nav className="flex flex-wrap gap-2 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? 'font-semibold text-primary underline'
                    : 'text-muted-foreground hover:underline'
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          المصدر المالي: PayrollRun —{' '}
          <Link href="/hr/monthly-salaries" className="underline">
            الرواتب الشهرية (Legacy)
          </Link>
        </p>
      </header>
      <main>{children}</main>
    </div>
  );
}
