'use client';

import { usePathname } from 'next/navigation';
import { ErpDocumentPageHeader } from '@/components/erp';

type SectionCrumb = { href: string; label: string };

function sectionCrumbFromPath(pathname: string): SectionCrumb | null {
  if (pathname.includes('/accounting-settings/company-settings')) {
    return {
      href: '/accounting-settings/company-settings/accounting-settings',
      label: 'إعدادات الشركة',
    };
  }
  if (pathname.includes('/accounting-settings/operations-management')) {
    return {
      href: '/accounting-settings/operations-management/post-all',
      label: 'إدارة العمليات',
    };
  }
  if (pathname.includes('/accounting-settings/database-tools')) {
    return {
      href: '/accounting-settings/database-tools/database-backup',
      label: 'أدوات قواعد البيانات',
    };
  }
  if (pathname.includes('/accounting-settings/translation')) {
    return {
      href: '/accounting-settings/translation/translate-messages',
      label: 'الترجمة',
    };
  }
  if (pathname.includes('/accounting-settings/create-user')) {
    return { href: '/accounting-settings/create-user-groups', label: 'المستخدمون والصلاحيات' };
  }
  return null;
}

export function AccountingSettingsPageHeader({
  title,
  extraActions,
}: {
  title: string;
  extraActions?: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const section = sectionCrumbFromPath(pathname);
  const breadcrumbs = [
    { href: '/accounting-settings', label: 'الإعدادات المحاسبية' },
    ...(section ? [section] : []),
    { label: title },
  ];

  return (
    <ErpDocumentPageHeader
      compact
      lockWhenPosted={false}
      breadcrumbs={breadcrumbs}
      title={title}
      statusTone="info"
      statusLabel="إعدادات"
      showDocumentRef={false}
      hideStandalonePost
      hideBrowseList
      hideActionMenu
      extraActions={extraActions}
    />
  );
}
