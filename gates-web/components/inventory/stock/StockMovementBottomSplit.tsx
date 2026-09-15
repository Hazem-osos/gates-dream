'use client';

import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
import { GeneratedJournalTab } from '@/components/erp/GeneratedJournalTab';
import { AuditActivityTab } from '@/components/erp/AuditActivityTab';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';

type Props = {
  totalAmount: number;
  journalEntryId?: string | null;
  documentId: string | null;
  lineCount: number;
};

export function StockMovementBottomSplit({
  totalAmount,
  journalEntryId,
  documentId,
  lineCount,
}: Props) {
  return (
    <ErpDocumentBottomSplit
      financialRows={[]}
      netAmount={totalAmount}
      netLabel="إجمالي الحركة"
      showTafqeet={false}
      financialFooter={
        <div className="space-y-2">
          <p className="text-sm text-slate-600 flex justify-between">
            <span>عدد الأسطر</span>
            <span className="font-medium tabular-nums">{lineCount}</span>
          </p>
          <div className="flex justify-start" dir="ltr">
            <GeneratedJournalTab
              journalEntryId={journalEntryId}
              pendingLabel="يتولد القيد آلياً فور الترحيل"
            />
          </div>
        </div>
      }
      journalEntryId={journalEntryId}
      tabs={[
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
