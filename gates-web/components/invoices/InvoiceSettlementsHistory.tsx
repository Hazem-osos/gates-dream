'use client';

import Link from 'next/link';
import { erpTableHeadCellClass, erpTableHeadRowClass } from '@/components/erp/erpUiTokens';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import {
  activeSettlementTotal,
  buildInvoiceInstallmentViews,
  buildInvoiceSettlementHistory,
  INVOICE_PAYMENT_STANCE_LABEL,
  resolveInvoicePaymentStance,
  type InvoiceCashSettlement,
  type InvoiceChequeSettlement,
  type InvoiceInstallmentSource,
  type InvoiceInstallmentView,
  type InvoicePaymentStance,
  type InvoiceSettlementHistoryRow,
} from '@/lib/invoices/invoice-settlements';

type Props = {
  settlements?: InvoiceCashSettlement[];
  cheques?: InvoiceChequeSettlement[];
  installments?: InvoiceInstallmentSource[];
  paidAmount?: number;
  remainingAmount?: number;
  netAmount?: number;
  direction?: 'RECEIPT' | 'PAYMENT';
  variant?: 'all' | 'stance' | 'collections';
  onCollectInstallment?: (row: InvoiceInstallmentView) => void;
};

function methodBadge(row: InvoiceSettlementHistoryRow) {
  const tone =
    row.source === 'CHEQUE'
      ? 'bg-amber-50 text-amber-800'
      : row.source === 'BANK'
        ? 'bg-sky-50 text-sky-800'
        : 'bg-emerald-50 text-emerald-800';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {row.methodLabel}
    </span>
  );
}

function stanceTone(stance: InvoicePaymentStance) {
  if (stance === 'settled') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (stance === 'partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function StanceBadge({ stance }: { stance: InvoicePaymentStance }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-bold ${stanceTone(stance)}`}
    >
      {INVOICE_PAYMENT_STANCE_LABEL[stance]}
    </span>
  );
}

export function InvoiceSettlementsHistory({
  settlements = [],
  cheques = [],
  installments = [],
  paidAmount,
  remainingAmount,
  netAmount,
  direction = 'RECEIPT',
  variant = 'all',
  onCollectInstallment,
}: Props) {
  const rows = buildInvoiceSettlementHistory(settlements, cheques);
  const collected = activeSettlementTotal(rows);
  const paid = Math.max(Number(paidAmount) || 0, collected);
  const remaining =
    netAmount != null
      ? Math.max(0, Number(netAmount) - paid)
      : remainingAmount != null
        ? Number(remainingAmount)
        : undefined;
  const stance = resolveInvoicePaymentStance(Number(netAmount) || 0, paid);
  const installmentViews = buildInvoiceInstallmentViews(installments, paid);
  const emptyLabel =
    direction === 'PAYMENT' ? 'لا توجد مدفوعات مسجلة على هذه الفاتورة.' : 'لا توجد تحصيلات مسجلة على هذه الفاتورة.';
  const movementsLabel = direction === 'PAYMENT' ? 'كل المدفوعات' : 'كل التحصيلات';

  const showStance = variant !== 'collections';
  const showCollections = variant !== 'stance';

  return (
    <div className="space-y-4">
      {showStance ? (
        <>
          <div className={`rounded-xl border px-3 py-3 ${stanceTone(stance)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold opacity-80">موقف الدفعات</div>
                <div className="text-base font-bold">{INVOICE_PAYMENT_STANCE_LABEL[stance]}</div>
              </div>
              <StanceBadge stance={stance} />
            </div>
          </div>

          {netAmount != null || paidAmount != null || remainingAmount != null ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-2 py-2">
                <div className="text-[11px] text-slate-500">إجمالي الفاتورة</div>
                <div className="text-sm font-semibold tabular-nums text-[#0A3D5E]">
                  {formatInvoiceMoney(Number(netAmount) || 0)}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-2">
                <div className="text-[11px] text-emerald-700">{direction === 'PAYMENT' ? 'المدفوع' : 'المحصّل'}</div>
                <div className="text-sm font-semibold tabular-nums text-emerald-800">
                  {formatInvoiceMoney(paid)}
                </div>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-2">
                <div className="text-[11px] text-amber-700">المتبقي</div>
                <div className="text-sm font-semibold tabular-nums text-amber-800">
                  {formatInvoiceMoney(Number(remaining) || 0)}
                </div>
              </div>
            </div>
          ) : null}

          {installmentViews.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#0A3D5E]">جدول الدفعات</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className={erpTableHeadRowClass}>
                    <th className={erpTableHeadCellClass}>#</th>
                    <th className={erpTableHeadCellClass}>الاستحقاق</th>
                    <th className={erpTableHeadCellClass}>المبلغ</th>
                    <th className={erpTableHeadCellClass}>{direction === 'PAYMENT' ? 'المسدد' : 'المحصّل'}</th>
                    <th className={erpTableHeadCellClass}>المتبقي</th>
                    <th className={erpTableHeadCellClass}>حالة الدفعة</th>
                    {onCollectInstallment ? <th className={erpTableHeadCellClass}>تحصيل</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {installmentViews.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100">
                      <td className="py-2 tabular-nums">{row.number}</td>
                      <td className="py-2">{row.dueDate}</td>
                      <td className="py-2 tabular-nums">{formatInvoiceMoney(row.amount)}</td>
                      <td className="py-2 tabular-nums">{formatInvoiceMoney(row.paidAmount)}</td>
                      <td className="py-2 tabular-nums">{formatInvoiceMoney(row.remainingAmount)}</td>
                      <td className="py-2">
                        <StanceBadge stance={row.stance} />
                      </td>
                      {onCollectInstallment ? (
                        <td className="py-2">
                          {row.remainingAmount > 0.0001 && row.id ? (
                            <button
                              type="button"
                              className="rounded-md bg-[#0E78AA] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#094C6B]"
                              onClick={() => onCollectInstallment(row)}
                            >
                              {direction === 'PAYMENT' ? 'سداد' : 'تحصيل'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}

      {showCollections ? (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[#0A3D5E]">{movementsLabel}</h3>
          {rows.length === 0 ? (
            <p className="p-2 text-sm text-slate-500">{emptyLabel}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className={erpTableHeadRowClass}>
                  <th className={erpTableHeadCellClass}>الرقم</th>
                  <th className={erpTableHeadCellClass}>الطريقة</th>
                  <th className={erpTableHeadCellClass}>الجهة</th>
                  <th className={erpTableHeadCellClass}>المبلغ</th>
                  <th className={erpTableHeadCellClass}>التاريخ</th>
                  <th className={erpTableHeadCellClass}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 ${row.cancelled ? 'text-slate-400 line-through' : ''}`}
                  >
                    <td className="py-2 font-mono text-xs">
                      {row.href ? (
                        <Link href={row.href} className="text-[#0E78AA] underline-offset-2 hover:underline">
                          {row.number}
                        </Link>
                      ) : (
                        row.number
                      )}
                    </td>
                    <td className="py-2">{methodBadge(row)}</td>
                    <td className="py-2 text-slate-600">{row.channel}</td>
                    <td className="py-2 tabular-nums">{formatInvoiceMoney(row.amount)}</td>
                    <td className="py-2">{row.date}</td>
                    <td className="py-2">{row.statusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
