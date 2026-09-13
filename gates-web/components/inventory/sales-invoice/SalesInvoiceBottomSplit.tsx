'use client';

import type { ReactNode } from 'react';
import {
  computeInvoiceGrossDiscount,
  computeLineSubtotalAfterDiscount,
  type InvoiceFinancialSummary as SummaryModel,
  type InvoiceSummaryLine,
} from '@/lib/invoices/computeInvoiceFinancialSummary';
import { EtaReadinessPanel } from '@/app/components/accounting/EtaReadinessPanel';
import { AuditActivityTab } from '@/components/erp/AuditActivityTab';
import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
import { erpTableHeadCellClass, erpTableHeadRowClass } from '@/components/erp/erpUiTokens';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { CalculationInspector } from '@/components/ai/CalculationInspector';

type SettlementRow = {
  id: string;
  transactionKind: string;
  voucherNumber?: string | null;
  date: string;
  amount: number | string;
  journalEntryId?: string | null;
};

type Props = {
  summary: SummaryModel;
  applyTax: boolean;
  lines: (InvoiceSummaryLine & { itemId?: string })[];
  warehouseId?: string;
  journalEntryId?: string | null;
  selectedInvoiceId: string | null;
  isPosted: boolean;
  settlements?: SettlementRow[];
  auditExtra?: ReactNode;
  termsAction?: ReactNode;
  activeTabId?: string;
  onActiveTabChange?: (tabId: string) => void;
  pricingCalculationBasis?: string;
};

export function SalesInvoiceBottomSplit({
  summary,
  applyTax,
  lines,
  warehouseId,
  journalEntryId,
  selectedInvoiceId,
  isPosted,
  settlements = [],
  auditExtra,
  termsAction,
  activeTabId,
  onActiveTabChange,
  pricingCalculationBasis,
}: Props) {
  const { gross, commercialDiscount } = computeInvoiceGrossDiscount(lines, pricingCalculationBasis);
  const stockRows = lines.filter(
    (l) => ((Number(l.baseQuantity) || Number(l.quantity) || 0) > 0) && l.itemId
  );

  const stockContent = !warehouseId ? (
    <p className="text-slate-500 p-2">اختر المخزن لعرض الأثر المخزني.</p>
  ) : stockRows.length === 0 ? (
    <p className="text-slate-500 p-2">لا توجد أسطر مخزنية.</p>
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
              <td className="py-2 font-mono text-xs text-slate-600">{line.itemId?.slice(0, 8)}…</td>
              <td className="py-2 text-center">{qty}</td>
              <td className="py-2 text-center text-red-700 font-medium">-{qty}</td>
              <td className="py-2 text-center tabular-nums">
                {formatInvoiceMoney(computeLineSubtotalAfterDiscount(line, pricingCalculationBasis))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const settlementsContent =
    settlements.length === 0 ? (
      <p className="text-slate-500 p-2">لا توجد تحصيلات مسجلة على هذه الفاتورة.</p>
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className={erpTableHeadRowClass}>
            <th className={erpTableHeadCellClass}>رقم</th>
            <th className={erpTableHeadCellClass}>نوع</th>
            <th className={erpTableHeadCellClass}>المبلغ</th>
            <th className={erpTableHeadCellClass}>التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {settlements.map((s) => (
            <tr key={s.id} className="border-b border-slate-100">
              <td className="py-2">{s.voucherNumber || s.id.slice(0, 8)}</td>
              <td className="py-2">{s.transactionKind === 'RECEIPT' ? 'قبض' : 'صرف'}</td>
              <td className="py-2 tabular-nums">{Number(s.amount).toFixed(2)}</td>
              <td className="py-2">{new Date(s.date).toLocaleDateString('ar-EG')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <div data-tour="invoice-impact-tabs">
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
                {
                  label: 'مجموع قبل الخصم',
                  value: `${formatInvoiceMoney(gross)} ج.م`,
                },
                {
                  label: 'خصومات الأسطر',
                  value: `− ${formatInvoiceMoney(commercialDiscount)} ج.م`,
                  tone: 'minus',
                },
                {
                  label: 'الصافي بعد الخصم',
                  value: `${formatInvoiceMoney(gross - commercialDiscount)} ج.م`,
                  tone: 'total',
                  hint: 'كل خصم يُطبَّق على صافي السطر بعد الخصم السابق عندما يكون الخصم المتسلسل مفعّلاً.',
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
        { label: 'رسم التنمية', value: summary.developmentFeeAmount },
        { label: 'ضريبة أ.ت.ص (خصم منبع)', value: -summary.withholdingTaxAmount },
        {
          label: 'إضافات / خصومات أخرى',
          value: summary.additionsAndDiscounts,
          show: summary.additionsAndDiscounts !== 0,
        },
      ]}
      netAmount={summary.netAmount}
      netLabel="الصافي المستحق"
      showTafqeet
      financialFooter={termsAction}
      journalEntryId={journalEntryId}
      activeTabId={activeTabId}
      onActiveTabChange={onActiveTabChange}
      tabs={[
        { id: 'stock', label: 'الأثر المخزني', content: stockContent },
        { id: 'settlements', label: 'التحصيلات', content: settlementsContent },
        {
          id: 'audit',
          label: 'سجل النشاط',
          content: (
            <AuditActivityTab entityType="INVOICE" entityId={selectedInvoiceId}>
              <EtaReadinessPanel invoiceId={selectedInvoiceId} isPosted={isPosted} />
              {auditExtra}
            </AuditActivityTab>
          ),
        },
      ]}
    />
    </div>
  );
}
