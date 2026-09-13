'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import {
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { formatDateAr, formatEgp, toMoney } from '@/lib/real-estate/format';
import type { UnitInstallment } from '@/lib/real-estate/types';
import { INSTALLMENT_TYPE_LABEL } from './StatusBadges';

function isOverdue(row: UnitInstallment): boolean {
  if (row.status === 'PAID' || row.status === 'CANCELLED') return false;
  if (row.status === 'OVERDUE') return true;
  return toMoney(row.balance) > 0 && new Date(row.dueDate).getTime() < Date.now();
}

function paymentStatus(row: UnitInstallment, overdue: boolean): { label: string; tone: StatusTone } {
  if (row.status === 'PAID') return { label: 'مسدد', tone: 'success' };
  if (row.status === 'OVERDUE' || overdue) return { label: 'متأخر', tone: 'danger' };
  return { label: 'مستحق', tone: 'warning' };
}

type InstallmentRow = UnitInstallment & {
  chequeNumber?: string | null;
  bankName?: string | null;
};

export function ContractInstallmentsTable({
  rows,
  onSettle,
  onPrintReceipt,
}: {
  rows: UnitInstallment[];
  onSettle?: (row: UnitInstallment) => void;
  onPrintReceipt?: (row: UnitInstallment) => void;
}) {
  if (!rows.length) {
    return <EmptyState title="لا يوجد جدول أقساط" description="ولّد جدول السداد من زر إنشاء الجدول." />;
  }

  const showCheque = rows.some((row) => row.chequeId || (row as InstallmentRow).chequeNumber);
  const showBank = rows.some((row) => (row as InstallmentRow).bankName);

  return (
    <div className={denseTableWrapClass}>
      <table className={denseTableClass}>
        <thead>
          <tr className={denseTheadClass}>
            <th className={denseThClass}>#</th>
            <th className={denseThClass}>النوع</th>
            <th className={denseThClass}>الاستحقاق</th>
            <th className={denseThClass}>الأصل</th>
            <th className={denseThClass}>المدفوع</th>
            <th className={denseThClass}>الرصيد</th>
            {showCheque ? <th className={denseThClass}>رقم الشيك</th> : null}
            {showBank ? <th className={denseThClass}>البنك</th> : null}
            <th className={denseThClass}>غرامة التأخير</th>
            <th className={denseThClass}>الحالة</th>
            <th className={denseThClass}>إجراء</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const extended = row as InstallmentRow;
            const late = toMoney(row.accumulatedLateFee);
            const overdue = isOverdue(row);
            const balance = toMoney(row.balance);
            const paid = toMoney(row.paidAmount);
            const status = paymentStatus(row, overdue);
            const chequeRef = row.chequeId ?? extended.chequeNumber;

            return (
              <tr key={row.id} className={denseTrClass}>
                <td className={denseTdClass}>{row.installmentNumber}</td>
                <td className={denseTdClass}>{INSTALLMENT_TYPE_LABEL[row.installmentType] ?? row.installmentType}</td>
                <td className={denseTdClass}>{formatDateAr(row.dueDate)}</td>
                <td className={`${denseTdClass} tabular-nums`}>{formatEgp(row.originalAmount || row.amount)}</td>
                <td className={`${denseTdClass} tabular-nums`}>{formatEgp(row.paidAmount)}</td>
                <td className={`${denseTdClass} tabular-nums font-semibold`}>{formatEgp(row.balance)}</td>
                {showCheque ? (
                  <td className={denseTdClass}>{chequeRef ?? '—'}</td>
                ) : null}
                {showBank ? (
                  <td className={denseTdClass}>{extended.bankName ?? '—'}</td>
                ) : null}
                <td className={denseTdClass}>
                  {late > 0 ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                      {formatEgp(late)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className={denseTdClass}>
                  <StatusBadge label={status.label} tone={status.tone} compact />
                </td>
                <td className={denseTdClass}>
                  <div className="flex flex-wrap justify-end gap-1">
                    {balance > 0 && onSettle ? (
                      <Button size="sm" onClick={() => onSettle(row)}>
                        تحصيل / تسوية
                      </Button>
                    ) : null}
                    {onPrintReceipt && paid > 0 ? (
                      <Button size="sm" variant="secondary" onClick={() => onPrintReceipt(row)}>
                        إيصال تحصيل
                      </Button>
                    ) : null}
                    {balance <= 0 && !(onPrintReceipt && paid > 0) ? (
                      <span className="text-slate-300">—</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
