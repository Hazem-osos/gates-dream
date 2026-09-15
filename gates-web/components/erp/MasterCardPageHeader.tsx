'use client';

import type { ReactNode } from 'react';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import type { ErpHeaderMenuItem } from '@/components/erp/ErpDocumentPageHeader';

type Crumb = { href?: string; label: string };

export type MasterCardPageHeaderProps = {
  title: string;
  breadcrumbs: Crumb[];
  docNumber?: string;
  statusLabel?: string;
  onSave?: () => void;
  savePending?: boolean;
  canSave?: boolean;
  onNew?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  currentId?: string | null;
  onBrowseList?: () => void;
  extraActions?: ReactNode;
  moreMenuItems?: ErpHeaderMenuItem[];
  favoriteHref?: string;
};

export function MasterCardPageHeader({
  title,
  breadcrumbs,
  docNumber,
  statusLabel = 'جديد',
  onSave,
  savePending,
  canSave = true,
  onNew,
  onDelete,
  deleteDisabled,
  currentId,
  onBrowseList,
  extraActions,
  moreMenuItems,
  favoriteHref,
}: MasterCardPageHeaderProps) {
  const items: ErpHeaderMenuItem[] = [
    ...(onNew ? [{ id: 'new', label: 'جديد', onClick: onNew }] : []),
    ...(onDelete
      ? [
          {
            id: 'del',
            label: 'حذف',
            onClick: onDelete,
            disabled: deleteDisabled ?? !currentId,
            destructive: true,
          },
        ]
      : []),
    ...(moreMenuItems ?? []),
  ];

  return (
    <ErpDocumentPageHeader
      compact
      lockWhenPosted={false}
      breadcrumbs={breadcrumbs}
      title={title}
      docNumber={docNumber || (currentId ? 'تعديل' : 'جديد')}
      statusTone="info"
      statusLabel={statusLabel}
      saveLabel="حفظ"
      onSaveDraft={onSave}
      savePending={savePending}
      canSave={canSave && !savePending}
      hideStandalonePost
      moreMenuItems={items}
      extraActions={extraActions}
      onBrowseList={onBrowseList}
      browseListLabel="السابق"
      currentId={currentId}
      favoriteHref={favoriteHref}
      favoriteLabel={title}
    />
  );
}

export function MasterCardShell({
  children,
  ...header
}: MasterCardPageHeaderProps & { children: ReactNode }) {
  return (
    <ErpDocumentLayout>
      <MasterCardPageHeader {...header} />
      {children}
    </ErpDocumentLayout>
  );
}
