'use client';

import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
import type { FinancialSummaryRow } from '@/components/erp/FinancialSummaryCard';
import { AuditActivityTab } from '@/components/erp/AuditActivityTab';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { DocumentLinkedStockMovementsTab } from '@/components/inventory/stock/DocumentLinkedStockMovementsTab';
import {
  LINKED_JOURNAL_EMPTY_SAVED,
  LINKED_JOURNAL_EMPTY_UNSAVED,
} from '@/lib/documents/linked-journal-preview';

type Props = {
  totalAmount: number;
  financialRows?: FinancialSummaryRow[];
  netLabel?: string;
  journalEntryId?: string | null;
  documentId: string | null;
  lineCount: number;
  isPosted?: boolean;
  /** When posted but GL was skipped (no journal id). */
  glSkipped?: boolean;
  /** Default: التأثير المخزني — e.g. نقل مخزني uses أثر مخزني */
  stockMovementsTabLabel?: string;
  movementSourceFallback?: { sourceType: string; sourceNumber: string } | null;
};

export function StockMovementBottomSplit({
  totalAmount,
  financialRows,
  netLabel = 'إجمالي الحركة',
  journalEntryId,
  documentId,
  lineCount,
  isPosted = false,
  glSkipped = false,
  stockMovementsTabLabel = 'التأثير المخزني',
  movementSourceFallback,
}: Props) {
  const journalEmptyTitle = !documentId
    ? LINKED_JOURNAL_EMPTY_UNSAVED
    : isPosted && glSkipped && !journalEntryId
      ? 'تم ترحيل المخزون دون قيد — تأكد من حسابات المخزون الدائم في إعدادات الشركة والمخازن.'
      : LINKED_JOURNAL_EMPTY_SAVED;

  return (
    <ErpDocumentBottomSplit
      financialRows={financialRows ?? []}
      netAmount={totalAmount}
      netLabel={netLabel}
      showTafqeet={Math.abs(totalAmount) > 0}
      journalEntryId={documentId ? journalEntryId : null}
      sourceDocumentId={documentId}
      journalEmptyTitle={journalEmptyTitle}
      financialFooter={
        <p className="text-sm text-slate-600 flex justify-between">
          <span>عدد الأسطر</span>
          <span className="font-medium tabular-nums">{lineCount}</span>
        </p>
      }
      tabs={[
        {
          id: 'stock-lines',
          label: stockMovementsTabLabel,
          content: (
            <DocumentLinkedStockMovementsTab
              documentId={documentId}
              isPosted={isPosted}
              movementSourceFallback={movementSourceFallback}
            />
          ),
        },
        {
          id: 'audit',
          label: 'سجل النشاط',
          content: (
            <AuditActivityTab entityType="STOCK_MOVEMENT" entityId={documentId}>
              <p className="text-slate-500 text-sm">القيمة: {formatInvoiceMoney(totalAmount)} ج.م</p>
            </AuditActivityTab>
          ),
        },
      ]}
    />
  );
}
