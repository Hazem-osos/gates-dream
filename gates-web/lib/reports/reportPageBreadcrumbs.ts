export type ReportBreadcrumb = { href?: string; label: string };

export function breadcrumbsForReportModule(
  module: string | undefined,
  currentTitle: string
): ReportBreadcrumb[] {
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
      return [
        { label: 'الموارد البشرية', href: '/hr' },
        { label: 'التقارير', href: '/hr/reports' },
        current,
      ];
    case 'manufacturing':
      return [
        { label: 'التصنيع', href: '/manufacturing' },
        { label: 'التقارير', href: '/manufacturing/reports' },
        current,
      ];
    case 'extracts':
      return [
        { label: 'المستخلصات', href: '/extracts' },
        { label: 'التقارير', href: '/extracts/reports' },
        current,
      ];
    case 'electronic-invoices':
      return [
        { label: 'الفواتير الإلكترونية', href: '/electronic-invoices' },
        { label: 'التقارير', href: '/electronic-invoices/reports' },
        current,
      ];
    case 'importexport':
      return [
        { label: 'الاستيراد والتصدير', href: '/importexport' },
        { label: 'التقارير', href: '/importexport/reports' },
        current,
      ];
    case 'real-estate-investment':
    case 'real-estate':
      return [
        { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
        { label: 'التقارير', href: '/real-estate-investment/reports' },
        current,
      ];
    case 'subcontracts':
      return [
        { label: 'مقاولو الباطن', href: '/subcontracts' },
        { label: 'التقارير', href: '/subcontracts/reports' },
        current,
      ];
    default:
      return [current];
  }
}
