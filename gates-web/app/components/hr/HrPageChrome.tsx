'use client';

import type { ReactNode } from 'react';
import { MasterCardShell } from '@/components/erp';
import type { ErpHeaderMenuItem } from '@/components/erp/ErpDocumentPageHeader';

export function HrPageChrome({
  title,
  breadcrumbs,
  docNumber,
  statusLabel = 'جديد',
  onSave,
  onNew,
  savePending,
  canSave = true,
  extraActions,
  moreMenuItems,
  favoriteHref,
  children,
  module: _module,
  shortcuts: _shortcuts,
  filters: _filters,
  refreshing: _refreshing,
  onRefresh: _onRefresh,
}: {
  title: string;
  breadcrumbs?: { href?: string; label: string }[];
  docNumber?: string;
  statusLabel?: string;
  onSave?: () => void;
  onNew?: () => void;
  savePending?: boolean;
  canSave?: boolean;
  extraActions?: ReactNode;
  moreMenuItems?: ErpHeaderMenuItem[];
  favoriteHref?: string;
  children: ReactNode;
  /** Kept so existing pages still type-check after the chrome swap. */
  module?: string;
  shortcuts?: unknown;
  filters?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <MasterCardShell
      title={title}
      breadcrumbs={
        breadcrumbs ?? [
          { label: 'الموارد البشرية', href: '/hr' },
          { label: title },
        ]
      }
      docNumber={docNumber}
      statusLabel={statusLabel}
      onSave={onSave}
      onNew={onNew}
      savePending={savePending}
      canSave={canSave}
      extraActions={extraActions}
      moreMenuItems={moreMenuItems}
      favoriteHref={favoriteHref}
    >
      {children}
    </MasterCardShell>
  );
}
