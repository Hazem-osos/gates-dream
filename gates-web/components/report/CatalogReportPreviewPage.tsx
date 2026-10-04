'use client';

import { usePathname } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { UniversalReportViewer } from '@/components/report/UniversalReportViewer';
import { AccountsBalanceSheet } from '@/components/report/AccountsBalanceSheet';
import { BalanceSheetStatement } from '@/components/report/BalanceSheetStatement';
import { TradingAccountSheet } from '@/components/report/TradingAccountSheet';
import { AccountBalancesSheet } from '@/components/report/AccountBalancesSheet';
import { getReportByUrlPath } from '@/lib/reports/reportCatalog';
import { breadcrumbsForReportModule } from '@/lib/reports/reportPageBreadcrumbs';

/**
 * Default export for report preview routes: resolves catalog entry from current pathname.
 */
export default function CatalogReportPreviewPage() {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const entry = getReportByUrlPath(pathname);

  if (!entry || entry.kind !== 'preview') {
    return (
      <div className="p-8 text-center text-slate-600" dir="rtl">
        <p className="font-semibold">تعذّر تحميل التقرير</p>
        <p className="text-sm mt-2">لم يُعثر على إعدادات المعاينة لهذا المسار.</p>
      </div>
    );
  }

  const registryPath = entry.registryPath;
  if (
    entry.reportKey === 'financial-position-statement' ||
    entry.reportKey === 'accounts-balance' ||
    entry.reportKey === 'trading-account' ||
    entry.reportKey === 'account-balances'
  ) {
    const query = Object.fromEntries(searchParams.entries());
    return (
      <div className="p-4" dir="rtl">
        {entry.reportKey === 'trading-account' ? (
          <TradingAccountSheet query={query} />
        ) : entry.reportKey === 'account-balances' ? (
          <AccountBalancesSheet query={query} />
        ) : entry.reportKey === 'accounts-balance' ? (
          <AccountsBalanceSheet query={query} />
        ) : (
          <BalanceSheetStatement query={query} />
        )}
      </div>
    );
  }

  return (
    <UniversalReportViewer
      registryPath={registryPath}
      reportKey={entry.reportKey}
      title={entry.titleAr}
      exportFileName={entry.reportKey}
      breadcrumbs={breadcrumbsForReportModule(entry.module, entry.titleAr)}
    />
  );
}
