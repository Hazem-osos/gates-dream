'use client';

import type { ReactNode } from 'react';
import {
  computeInvoiceGrossDiscount,
  computeLineSubtotalAfterDiscount,
  formatInvoiceMoney,
  type InvoiceFinancialSummary as SummaryModel,
  type InvoiceSummaryLine,
} from '@/lib/invoices/computeInvoiceFinancialSummary';
import { CalculationInspector } from '@/components/ai/CalculationInspector';
import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
import { AuditActivityTab } from '@/components/erp/AuditActivityTab';
import { erpTableHeadCellClass, erpTableHeadRowClass } from '@/components/erp/erpUiTokens';
import { InvoiceSettlementsHistory } from '@/components/invoices/InvoiceSettlementsHistory';
import { useApiQuery } from '@/lib/hooks/useApi';
import type {
  InvoiceCashSettlement,
  InvoiceChequeSettlement,
  InvoiceInstallmentSource,
} from '@/lib/invoices/invoice-settlements';

type Props = {
  summary: SummaryModel;
  applyTax: boolean;
  lines: (InvoiceSummaryLine & { itemId?: string })[];
  warehouseId?: string;
  journalEntryId?: string | null;
  selectedInvoiceId: string | null;
  isPosted: boolean;
  auditExtra?: ReactNode;
  pricingCalculationBasis?: string;
  settlements?: InvoiceCashSettlement[];
  cheques?: InvoiceChequeSettlement[];
  installments?: InvoiceInstallmentSource[];
  paidAmount?: number;
  remainingAmount?: number;
  activeTabId?: string;
  onActiveTabChange?: (tabId: string) => void;
};

export function PurchaseInvoiceBottomSplit({
  summary,
  applyTax,
  lines,
  warehouseId,
  journalEntryId,
  selectedInvoiceId,
  isPosted,
  auditExtra,
  pricingCalculationBasis,
  settlements = [],
  cheques = [],
  installments = [],
  paidAmount,
  remainingAmount,
  activeTabId,
  onActiveTabChange,
}: Props) {
  const { data: savedInstallmentsResponse } = useApiQuery<InvoiceInstallmentSource[]>(
    ['invoice-installments', selectedInvoiceId],
    `/invoices/${selectedInvoiceId}/installments`,
    undefined,
    { enabled: Boolean(selectedInvoiceId), skipErrorNotify: true }
  );
  const installmentRows = (savedInstallmentsResponse?.data?.length
    ? savedInstallmentsResponse.data
    : installments) ?? [];
  const { gross, commercialDiscount } = computeInvoiceGrossDiscount(lines, pricingCalculationBasis);
  const stockRows = lines.filter(
    (l) => ((Number(l.baseQuantity) || Number(l.quantity) || 0) > 0) && l.itemId
  );

  const stockContent = !warehouseId ? (
    <p className="text-slate-500 p-2">اختر المخزن.</p>
  ) : stockRows.length === 0 ? (
    <p className="text-slate-500 p-2">لا أسطر.</p>
  ) : (
    <table className="w-full text-sm">
      <thead>
        <tr className={erpTableHeadRowClass}>
          <th className={erpTableHeadCellClass}>صنف</th>
          <th className={erpTableHeadCellClass}>كمية</th>
          <th className={erpTableHeadCellClass}>Δ</th>
          <th className={erpTableHeadCellClass}>قيمة</th>
        </tr>
      </thead>
      <tbody>
        {stockRows.map((line, i) => {
          const qty = Number(line.baseQuantity) || Number(line.quantity) || 0;
          return (
            <tr key={`${line.itemId}-${i}`} className="border-b border-slate-100">
              <td className="py-2 font-mono text-xs">{line.itemId?.slice(0, 8)}…</td>
              <td className="py-2 text-center">{qty}</td>
              <td className="py-2 text-center text-emerald-700 font-medium">+{qty}</td>
              <td className="py-2 text-center tabular-nums">
                {formatInvoiceMoney(computeLineSubtotalAfterDiscount(line, pricingCalculationBasis))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <ErpDocumentBottomSplit
      financialRows={[
        { label: 'المجموع قبل الضريبة', value: gross },
        {
          label: 'خصم تجاري',
          value: -commercialDiscount,
          suffix: (
            <CalculationInspector
              title="تفصيل الخصم المتسلسل"
              triggerLabel="تفاصيل الخصم"
              rows={[
                { label: 'مجموع قبل الخصم', value: `${formatInvoiceMoney(gross)} ج.م` },
                {
                  label: 'خصومات الأسطر',
                  value: `− ${formatInvoiceMoney(commercialDiscount)} ج.م`,
                  tone: 'minus',
                },
                {
                  label: 'الصافي بعد الخصم',
                  value: `${formatInvoiceMoney(gross - commercialDiscount)} ج.م`,
                  tone: 'total',
                },
              ]}
            />
          ),
        },
        { label: 'صافي خاضع للضريبة', value: summary.subtotalWithoutTax },
        {
          label: applyTax ? 'ضريبة القيمة المضافة (ض.ق.م)' : 'ضريبة القيمة المضافة (ض.ق.م) — معطّلة',
          value: summary.taxAmount,
        },
        {
          label: 'رسم التنمية',
          value: summary.developmentFeeAmount,
          show: summary.developmentFeeAmount !== 0,
        },
        { label: 'ضريبة خصم المنبع', value: -summary.withholdingTaxAmount, dataTour: 'wht-section' },
      ]}
      netAmount={summary.netAmount}
      journalEntryId={journalEntryId}
      activeTabId={activeTabId}
      onActiveTabChange={onActiveTabChange}
      tabs={[
        { id: 'stock', label: 'الأثر المخزني', content: stockContent },
        {
          id: 'settlements',
          label: 'موقف الدفعات',
          content: (
            <InvoiceSettlementsHistory
              settlements={settlements}
              cheques={cheques}
              installments={installmentRows}
              paidAmount={paidAmount}
              remainingAmount={remainingAmount}
              netAmount={summary.netAmount}
              direction="PAYMENT"
            />
          ),
        },
        {
          id: 'audit',
          label: 'سجل النشاط',
          content: (
            <AuditActivityTab entityType="INVOICE" entityId={selectedInvoiceId}>
              {auditExtra}
              {!isPosted ? <p className="text-slate-500">الفاتورة غير مرحّلة بعد.</p> : null}
            </AuditActivityTab>
          ),
        },
      ]}
    />
  );
}
