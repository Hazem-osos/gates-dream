'use client';

import { erpTableHeadCellClass, erpTableHeadRowClass } from '@/components/erp/erpUiTokens';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import {
  activeSettlementTotal,
  buildInvoiceSettlementHistory,
  type InvoiceCashSettlement,
  type InvoiceChequeSettlement,
  type InvoiceSettlementHistoryRow,
} from '@/lib/invoices/invoice-settlements';

type Props = {
  settlements?: InvoiceCashSettlement[];
  cheques?: InvoiceChequeSettlement[];
  paidAmount?: number;
  remainingAmount?: number;
  netAmount?: number;
  direction?: 'RECEIPT' | 'PAYMENT';
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

export function InvoiceSettlementsHistory({
  settlements = [],
  cheques = [],
  paidAmount,
  remainingAmount,
  netAmount,
  direction = 'RECEIPT',
}: Props) {
  const rows = buildInvoiceSettlementHistory(settlements, cheques);
  const collected = activeSettlementTotal(rows);
  const paid = paidAmount ?? collected;
  const remaining =
    remainingAmount ??
    (netAmount != null ? Math.max(0, Number(netAmount) - paid) : undefined);
  const emptyLabel =
    direction === 'PAYMENT' ? 'لا توجد مدفوعات مسجلة على هذه الفاتورة.' : 'لا توجد تحصيلات مسجلة على هذه الفاتورة.';

  return (
    <div className="space-y-3">
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
                <td className="py-2 font-mono text-xs">{row.number}</td>
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
  );
}
