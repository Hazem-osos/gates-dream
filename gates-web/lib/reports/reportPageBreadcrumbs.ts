import type { PageHeaderProps } from '@/components/ui';

export function breadcrumbsForReportModule(
  module: string | undefined,
  currentTitle: string
): PageHeaderProps['breadcrumbs'] {
  const current = { label: currentTitle };
  switch (module) {
    case 'inventory':
      return [
        { label: 'المخزون', href: '/inventory' },
        { label: 'التقارير', href: '/inventory/reports' },
        current,
      ];
    case 'accounting':
      return [
        { label: 'المحاسبة', href: '/accounting' },
        { label: 'تقارير الحسابات', href: '/accounting/account-reports' },
        current,
      ];
    case 'hr':
      return [{ label: 'الموارد البشرية', href: '/hr' }, { label: 'التقارير', href: '/hr/reports' }, current];
    default:
      return [current];
  }
}
