'use client';

import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
import { AuditActivityTab } from '@/components/erp/AuditActivityTab';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { DocumentLinkedStockMovementsTab } from '@/components/inventory/stock/DocumentLinkedStockMovementsTab';

type Props = {
  totalAmount: number;
  journalEntryId?: string | null;
  documentId: string | null;
  lineCount: number;
  isPosted?: boolean;
  /** When posted but GL was skipped (no journal id). */
  glSkipped?: boolean;
  /** Default: التقسير المخزني — e.g. نقل مخزني uses أثر مخزني */
  stockMovementsTabLabel?: string;
};

export function StockMovementBottomSplit({
  totalAmount,
  journalEntryId,
  documentId,
  lineCount,
  isPosted = false,
  glSkipped = false,
  stockMovementsTabLabel = 'التقسير المخزني',
}: Props) {
  const journalEmptyTitle = !isPosted
    ? 'يظهر القيد المحاسبي بعد حفظ وترحيل المستند.'
    : glSkipped || !journalEntryId
      ? 'تم ترحيل المخزون دون قيد — تأكد من حسابات المخزون الدائم في إعدادات الشركة والمخازن.'
      : 'لا يوجد قيد محاسبي بعد.';

  return (
    <ErpDocumentBottomSplit
      financialRows={[]}
      netAmount={totalAmount}
      netLabel="إجمالي الحركة"
      showTafqeet={totalAmount > 0}
      journalEntryId={isPosted ? journalEntryId : null}
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
            <DocumentLinkedStockMovementsTab documentId={documentId} isPosted={isPosted} />
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
