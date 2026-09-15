'use client';

import { useState, type ReactNode } from 'react';
import { InvoiceFinancialSummary } from '@/components/inventory/InvoiceFinancialSummary';
import { InvoiceJournalEntryLinesTable } from '@/components/inventory/InvoiceJournalEntryLinesTable';
import {
  computeLineSubtotalAfterDiscount,
  formatInvoiceMoney,
  type InvoiceFinancialSummary as InvoiceFinancialSummaryModel,
  type InvoiceSummaryLine,
} from '@/lib/invoices/computeInvoiceFinancialSummary';
import { tafqeetEgp } from '@/lib/print/tafqeet';
import { DocumentActivityLog } from '@/app/components/accounting/DocumentActivityLog';
import { EtaReadinessPanel } from '@/app/components/accounting/EtaReadinessPanel';

type StockLine = InvoiceSummaryLine & { itemId?: string };

type Props = {
  variant: 'sales' | 'purchase';
  summary: InvoiceFinancialSummaryModel;
  taxLabel: string;
  applyTax: boolean;
  journalEntryId?: string | null;
  selectedInvoiceId: string | null;
  isPosted: boolean;
  lines: StockLine[];
  warehouseId?: string;
  auditExtra?: ReactNode;
  financialChildren?: ReactNode;
};

const tabs = [
  { id: 'gl', label: 'معاينة القيد المحاسبي' },
  { id: 'financial', label: 'الملخص المالي والضرائب' },
  { id: 'stock', label: 'الأثر المخزني' },
  { id: 'audit', label: 'سجل الحركات' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function InvoiceEnterpriseFooterTabs({
  variant,
  summary,
  taxLabel,
  applyTax,
  journalEntryId,
  selectedInvoiceId,
  isPosted,
  lines,
  warehouseId,
  auditExtra,
  financialChildren,
}: Props) {
  const [active, setActive] = useState<TabId>('financial');

  const stockRows = lines.filter((l) => (Number(l.quantity) || 0) > 0 && l.itemId);

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-[#E6F0F7] bg-white shadow-sm" dir="rtl">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#E6F0F7] bg-[#F6FBFD] p-2" dir="ltr">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              active === t.id
                ? 'bg-[#0E78AA] text-white font-medium'
                : 'text-[#0A3D5E] hover:bg-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {active === 'financial' ? (
          <div className="space-y-4">
            <InvoiceFinancialSummary summary={summary} taxLabel={taxLabel}>
              {financialChildren}
            </InvoiceFinancialSummary>
            <div className="rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] p-4 text-sm text-[#0A3D5E]">
              <span className="font-semibold block mb-1">المبلغ كتابةً (تفقيط)</span>
              <p className="leading-relaxed">{tafqeetEgp(summary.netAmount)}</p>
            </div>
            {!applyTax ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                الفاتورة غير خاضعة للضريبة — لن تُحسب ضريبة القيمة المضافة في الإجمالي.
              </p>
            ) : null}
          </div>
        ) : null}

        {active === 'gl' ? (
          <InvoiceJournalEntryLinesTable
            journalEntryId={journalEntryId}
            title="معاينة القيد المحاسبي"
          />
        ) : null}

        {active === 'stock' ? (
          <div className="overflow-x-auto rounded-2xl border border-[#D6EAF3] bg-white">
            <div className="text-[#0E78AA] font-bold text-sm px-4 py-3 border-b border-[#D6EAF3]">
              الأثر المخزني المتوقع
            </div>
            {!warehouseId ? (
              <p className="p-4 text-sm text-gray-500">اختر المخزن لعرض أثر الحركة.</p>
            ) : stockRows.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">لا توجد أسطر أصناف ذات كمية.</p>
            ) : (
              <table className="min-w-full text-center border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-[#0E78AA] text-white">
                    <th className="py-2 px-2">الصنف</th>
                    <th className="py-2 px-2">الكمية</th>
                    <th className="py-2 px-2">Δ مخزون</th>
                    <th className="py-2 px-2">قيمة تقريبية</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((line, i) => {
                    const qty = Number(line.quantity) || 0;
                    const delta = variant === 'sales' ? -qty : qty;
                    const val = computeLineSubtotalAfterDiscount(line);
                    return (
                      <tr key={`${line.itemId}-${i}`} className={i % 2 ? 'bg-white' : 'bg-[#F6FBFD]'}>
                        <td className="py-2 px-2 border-x border-[#D6EAF3] font-mono text-xs">
                          {line.itemId?.slice(0, 8)}…
                        </td>
                        <td className="py-2 px-2 border-x border-[#D6EAF3]">{qty}</td>
                        <td className="py-2 px-2 border-x border-[#D6EAF3]">
                          {delta > 0 ? `+${delta}` : delta}
                        </td>
                        <td className="py-2 px-2 border-x border-[#D6EAF3]">
                          {formatInvoiceMoney(val)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {active === 'audit' ? (
          <div className="space-y-4">
            <EtaReadinessPanel invoiceId={selectedInvoiceId} isPosted={isPosted} />
            <DocumentActivityLog entityType="INVOICE" entityId={selectedInvoiceId} />
            {auditExtra}
          </div>
        ) : null}
      </div>
    </div>
  );
}
