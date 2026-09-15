'use client';

import { useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ErpDocumentPageHeader } from './ErpDocumentPageHeader';
import { useScreenChromeCount } from './AppScreenChromeContext';
import { resolveAiScreenContext } from '@/lib/ai/screen-context';
import { resolveTabLabel } from '@/lib/navigation/tab-labels';

export function AppScreenChromeFallback() {
  const count = useScreenChromeCount();
  const [settled, setSettled] = useState(false);
  const pathname = usePathname();
  const title =
    resolveTabLabel(pathname) ||
    resolveAiScreenContext(pathname ?? '').pageTitle ||
    'Gates Soft';

  useLayoutEffect(() => {
    setSettled(true);
  }, []);

  if (!settled || count > 0) return null;

  const isReport =
    Boolean(pathname) &&
    (/\/reports(\/|$)/.test(pathname) ||
      /\/account-reports(\/|$)/.test(pathname) ||
      /report(\/|$)/i.test(pathname ?? ''));

  return (
    <ErpDocumentPageHeader
      breadcrumbs={[]}
      title={title}
      showDocumentRef={false}
      statusTone="neutral"
      statusLabel=""
      favoriteHref={pathname ?? ''}
      favoriteLabel={title}
      registerChrome={false}
      hideStandalonePost
      hideBrowseList={isReport}
      hideActionMenu={isReport}
      moreMenuItems={
        isReport
          ? undefined
          : [
              { id: 'add', label: 'جديد', onClick: () => {}, disabled: true },
              { id: 'edit', label: 'تعديل', onClick: () => {}, disabled: true },
              { id: 'delete', label: 'حذف', onClick: () => {}, disabled: true, destructive: true },
            ]
      }
    />
  );
}
