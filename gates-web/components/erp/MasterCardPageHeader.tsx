'use client';

import type { ReactNode } from 'react';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import type { DocumentActionMenuProps } from '@/components/common/document-shell/DocumentActionMenu';
import type { ErpHeaderMenuItem } from '@/components/erp/ErpDocumentPageHeader';
import {
  masterArchiveTarget,
  type MasterArchiveEntityType,
} from '@/lib/attachments/archive-entity';

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
  onEdit?: () => void;
  editDisabled?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  onPrint?: () => void;
  printLabel?: string;
  printDocumentReady?: boolean;
  standardActions?: DocumentActionMenuProps;
  /** أرشفة بطاقة (صنف، عميل، مورد، …) من قائمة (⋯). */
  masterArchiveEntityType?: MasterArchiveEntityType;
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
  onEdit,
  editDisabled,
  onCancel,
  cancelLabel = 'تراجع',
  onPrint,
  printLabel = 'طباعة',
  printDocumentReady,
  standardActions: standardActionsProp,
  masterArchiveEntityType,
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

  const archiveTarget = masterArchiveEntityType
    ? masterArchiveTarget(masterArchiveEntityType, currentId)
    : null;

  const standardActions =
    standardActionsProp ??
    (onPrint || onNew || onDelete || masterArchiveEntityType
      ? {
          hasDocument: printDocumentReady ?? Boolean(currentId),
          documentId: currentId ?? undefined,
          archiveTarget,
          onPrint,
          printLabel,
          onNew,
          onVoid: onDelete ? () => onDelete() : undefined,
          voidLabel: 'حذف',
          extraItems: items.filter((item) => item.id !== 'new' && item.id !== 'del'),
        }
      : undefined);

  return (
    <ErpDocumentPageHeader
      compact
      lockWhenPosted={false}
      breadcrumbs={breadcrumbs}
      title={title}
      docNumber={docNumber || (currentId ? '—' : 'جديد')}
      statusTone="info"
      statusLabel={statusLabel}
      saveLabel="حفظ"
      onSaveDraft={onSave}
      savePending={savePending}
      canSave={canSave && !savePending}
      hideStandalonePost
      onEdit={onEdit}
      editDisabled={editDisabled}
      onCancel={onCancel}
      cancelLabel={cancelLabel}
      moreMenuItems={standardActions ? undefined : items}
      standardActions={standardActions}
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
