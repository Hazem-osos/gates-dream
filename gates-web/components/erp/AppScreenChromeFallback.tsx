'use client';

import { useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ErpDocumentPageHeader } from './ErpDocumentPageHeader';
import { useScreenChromeCount } from './AppScreenChromeContext';
import { resolveAiScreenContext } from '@/lib/ai/screen-context';

export function AppScreenChromeFallback() {
  const count = useScreenChromeCount();
  const [settled, setSettled] = useState(false);
  const pathname = usePathname();
  const title = resolveAiScreenContext(pathname ?? '').pageTitle || 'Gates Soft';

  useLayoutEffect(() => {
    setSettled(true);
  }, []);

  if (!settled || count > 0) return null;

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
      moreMenuItems={[
        { id: 'add', label: 'جديد', onClick: () => {}, disabled: true },
        { id: 'edit', label: 'تعديل', onClick: () => {}, disabled: true },
        { id: 'delete', label: 'حذف', onClick: () => {}, disabled: true, destructive: true },
      ]}
    />
  );
}
