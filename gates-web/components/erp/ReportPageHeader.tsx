'use client';

import type { ReactNode } from 'react';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader, type ErpHeaderMenuItem } from '@/components/erp/ErpDocumentPageHeader';

type Crumb = { href?: string; label: string };

export type ReportPageHeaderProps = {
  title: string;
  breadcrumbs?: Crumb[];
  statusLabel?: string;
  extraActions?: ReactNode;
  moreMenuItems?: ErpHeaderMenuItem[];
  favoriteHref?: string;
};

export function ReportPageHeader({
  title,
  breadcrumbs = [],
  statusLabel = 'تقرير',
  extraActions,
  moreMenuItems,
  favoriteHref,
}: ReportPageHeaderProps) {
  return (
    <ErpDocumentPageHeader
      compact
      lockWhenPosted={false}
      breadcrumbs={breadcrumbs}
      title={title}
      showDocumentRef={false}
      statusTone="info"
      statusLabel={statusLabel}
      hideStandalonePost
      hideBrowseList
      hideActionMenu={!moreMenuItems?.length}
      extraActions={extraActions}
      moreMenuItems={moreMenuItems}
      favoriteHref={favoriteHref}
      favoriteLabel={title}
    />
  );
}

export function ReportPageShell({
  children,
  ...header
}: ReportPageHeaderProps & { children: ReactNode }) {
  return (
    <ErpDocumentLayout>
      <ReportPageHeader {...header} />
      {children}
    </ErpDocumentLayout>
  );
}
