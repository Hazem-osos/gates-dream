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
import type { InvoiceCashSettlement, InvoiceChequeSettlement } from '@/lib/invoices/invoice-settlements';

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
  freightAmount?: number;
  supplierDiscountAmount?: number;
  onFreightAmountChange?: (value: number) => void;
  onSupplierDiscountAmountChange?: (value: number) => void;
  extrasReadOnly?: boolean;
  settlements?: InvoiceCashSettlement[];
  cheques?: InvoiceChequeSettlement[];
  paidAmount?: number;
  remainingAmount?: number;
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
  freightAmount = 0,
  supplierDiscountAmount = 0,
  onFreightAmountChange,
  onSupplierDiscountAmountChange,
  extrasReadOnly,
  settlements = [],
  cheques = [],
  paidAmount,
  remainingAmount,
}: Props) {
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
        { label: 'إضافات وتكلفة الشحن', value: summary.additionsAndDiscounts, dataTour: 'landed-cost-extras' },
      ]}
      netAmount={summary.netAmount}
      journalEntryId={journalEntryId}
      financialFooter={
        <div className="grid grid-cols-2 gap-2" data-tour="landed-cost-extras">
          <label className="text-[11px] text-slate-600">
            مصاريف الشحن
            <input
              type="number"
              min={0}
              step="0.01"
              readOnly={extrasReadOnly}
              value={freightAmount || ''}
              onChange={(event) => onFreightAmountChange?.(Number(event.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="text-[11px] text-slate-600">
            خصم المورد
            <input
              type="number"
              min={0}
              step="0.01"
              readOnly={extrasReadOnly}
              value={supplierDiscountAmount || ''}
              onChange={(event) => onSupplierDiscountAmountChange?.(Number(event.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
        </div>
      }
      tabs={[
        { id: 'stock', label: 'الأثر المخزني', content: stockContent },
        {
          id: 'settlements',
          label: 'المدفوعات',
          content: (
            <InvoiceSettlementsHistory
              settlements={settlements}
              cheques={cheques}
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
