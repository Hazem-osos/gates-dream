'use client';

import { ErpDocumentPageHeader } from '@/components/erp';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import type { StatusTone } from '@/components/ui/StatusBadge';
import { movementAmount, type MovementRow } from './types';

type Props = {
  title: string;
  favoriteHref: string;
  breadcrumbs: { href?: string; label: string }[];
  statusLabel: string;
  statusTone: StatusTone;
  savePending?: boolean;
  canExecute: boolean;
  hasSource: boolean;
  hasRows: boolean;
  allSelected: boolean;
  loadLabel: string;
  onNew: () => void;
  onLoad: () => void;
  onToggleAll: () => void;
  onExecute: () => void;
  onPrint: () => void;
};

export function movementTransferStatus(
  pending: boolean,
  selectedCount: number,
  hasDest: boolean,
  hasRows: boolean
): { statusLabel: string; statusTone: StatusTone } {
  if (pending) return { statusLabel: 'جاري التنفيذ', statusTone: 'warning' };
  if (selectedCount > 0 && hasDest) return { statusLabel: 'جاهز للنقل', statusTone: 'success' };
  if (hasRows) return { statusLabel: 'معاينة', statusTone: 'info' };
  return { statusLabel: 'جديد', statusTone: 'info' };
}

export function printMovementPreview(input: {
  title: string;
  sourceLabel: string;
  destLabel: string;
  date: string;
  rows: MovementRow[];
}) {
  return printOperationalDocument({
    title: input.title,
    documentNo: input.sourceLabel,
    documentDate: input.date,
    sellerName: input.sourceLabel,
    buyerName: input.destLabel,
    lines: input.rows.map((row) => ({
      description: `${row.documentNumber} — ${row.date} — ${row.description || '—'} (${row.statusLabel})`,
      quantity: 1,
      unitPrice: movementAmount(row),
      total: movementAmount(row),
    })),
  });
}

export function MovementTransferPageHeader({
  title,
  favoriteHref,
  breadcrumbs,
  statusLabel,
  statusTone,
  savePending,
  canExecute,
  hasSource,
  hasRows,
  allSelected,
  loadLabel,
  onNew,
  onLoad,
  onToggleAll,
  onExecute,
  onPrint,
}: Props) {
  return (
    <ErpDocumentPageHeader
      compact
      lockWhenPosted={false}
      breadcrumbs={breadcrumbs}
      title={title}
      showDocumentRef={false}
      statusTone={statusTone}
      statusLabel={statusLabel}
      saveLabel="تنفيذ النقل"
      onSaveDraft={onExecute}
      savePending={savePending}
      canSave={canExecute && !savePending}
      hideStandalonePost
      hideBrowseList
      favoriteHref={favoriteHref}
      favoriteLabel={title}
      moreMenuItems={[
        { id: 'new', label: 'جديد', onClick: onNew },
        { id: 'load', label: loadLabel, onClick: onLoad, disabled: !hasSource },
        {
          id: 'toggle-all',
          label: allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل',
          onClick: onToggleAll,
          disabled: !hasRows,
        },
        { id: 'print', label: 'طباعة المعاينة', onClick: onPrint, disabled: !hasRows },
        {
          id: 'execute',
          label: 'تنفيذ النقل',
          onClick: onExecute,
          disabled: !canExecute || Boolean(savePending),
        },
      ]}
    />
  );
}
