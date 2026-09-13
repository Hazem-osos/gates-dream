'use client';

import Link from 'next/link';
import { ArrowUpLeft, FileText } from 'lucide-react';
import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">القيد المحاسبي:</span>
            {journalEntryId ? (
              <Link
                href={`/accounting/operations/journal-entry?id=${encodeURIComponent(journalEntryId)}`}
                title="عرض القيد المحاسبي المتولد"
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>عرض القيد المحاسبي المتولد</span>
                <ArrowUpLeft className="h-3 w-3" />
              </Link>
            ) : (
              <span className="rounded border border-border bg-muted px-2 py-0.5 text-xs italic text-muted-foreground/80">
                يتولد القيد آلياً فور الترحيل
              </span>
            )}
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
