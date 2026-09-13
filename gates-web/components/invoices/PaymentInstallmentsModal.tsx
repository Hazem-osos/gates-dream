'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { erpInputClass, erpLabelClass } from '@/components/erp';
import { erpTableHeadCellClass, erpTableHeadRowClass } from '@/components/erp/erpUiTokens';
import { toHijriMedium } from '@/lib/dates/hijri';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import {
  emptyInstallmentRow,
  generatePaymentInstallments,
  INSTALLMENT_FREQUENCY_LABELS,
  periodicInstallmentPreview,
  renumberInstallments,
  roundInstallmentMoney,
  sumPaymentInstallments,
  type InstallmentFrequency,
  type PaymentInstallmentRow,
} from '@/lib/invoices/payment-installments';

type Props = {
  open: boolean;
  onClose: () => void;
  remainingAmount: number;
  startDate?: string;
  initial?: PaymentInstallmentRow[];
  onConfirm: (rows: PaymentInstallmentRow[]) => void;
  disabled?: boolean;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function PaymentInstallmentsModal({
  open,
  onClose,
  remainingAmount,
  startDate,
  initial = [],
  onConfirm,
  disabled = false,
}: Props) {
  const [rows, setRows] = useState<PaymentInstallmentRow[]>(initial);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [error, setError] = useState('');
  const [totalAmount, setTotalAmount] = useState(String(remainingAmount || ''));
  const [installmentCount, setInstallmentCount] = useState('3');
  const [frequency, setFrequency] = useState<InstallmentFrequency>('monthly');
  const [planStartDate, setPlanStartDate] = useState(startDate || todayIso());
  const [firstAmount, setFirstAmount] = useState('');
  const [lastAmount, setLastAmount] = useState('');

  useEffect(() => {
    if (!open) return;
    setRows(initial);
    setPlannerOpen(false);
    setError('');
    setTotalAmount(remainingAmount > 0 ? String(roundInstallmentMoney(remainingAmount)) : '');
    setInstallmentCount('3');
    setFrequency('monthly');
    setPlanStartDate(startDate || todayIso());
    setFirstAmount('');
    setLastAmount('');
    // Hydrate only when the dialog opens — not when the invoice net changes underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const plannerHijri = toHijriMedium(planStartDate);
  const periodicPreview = useMemo(
    () =>
      periodicInstallmentPreview({
        totalAmount: Number(totalAmount) || 0,
        installmentCount: Number(installmentCount) || 0,
        firstAmount: firstAmount === '' ? 0 : Number(firstAmount),
        lastAmount: lastAmount === '' ? 0 : Number(lastAmount),
      }),
    [totalAmount, installmentCount, firstAmount, lastAmount]
  );
  const rowsTotal = sumPaymentInstallments(rows);
  const target = roundInstallmentMoney(Number(totalAmount) || remainingAmount || 0);
  const difference = roundInstallmentMoney(target - rowsTotal);

  const updateRow = (id: string, patch: Partial<PaymentInstallmentRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addManualRow = () => {
    const last = rows[rows.length - 1];
    setRows((current) =>
      renumberInstallments([
        ...current,
        emptyInstallmentRow(current.length + 1, last?.dueDate || planStartDate || todayIso()),
      ])
    );
  };

  const removeRow = (id: string) => {
    setRows((current) => renumberInstallments(current.filter((row) => row.id !== id)));
  };

  const applyDistribution = () => {
    try {
      const generated = generatePaymentInstallments({
        totalAmount: Number(totalAmount) || 0,
        installmentCount: Number(installmentCount) || 0,
        frequency,
        startDate: planStartDate,
        firstAmount: firstAmount === '' ? 0 : Number(firstAmount),
        lastAmount: lastAmount === '' ? 0 : Number(lastAmount),
      });
      setRows(generated);
      setError('');
      setPlannerOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تطبيق التوزيع');
    }
  };

  const handleDone = () => {
    onConfirm(renumberInstallments(rows));
    onClose();
  };

  return (
    <CenteredOverlay open={open} onClose={handleDone} width="lg" labelledBy="payment-installments-title">
      <div className="relative shrink-0 bg-gradient-to-l from-[#0E78AA] to-[#1E88E5] px-5 py-4">
        <h2 id="payment-installments-title" className="text-center text-lg font-bold text-white">
          توزيع الدفعات
        </h2>
        <button
          type="button"
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/90 hover:bg-white/10 hover:text-white"
          onClick={handleDone}
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setTotalAmount(remainingAmount > 0 ? String(roundInstallmentMoney(remainingAmount)) : totalAmount);
              setPlannerOpen((openNow) => !openNow);
              setError('');
            }}
          >
            توزيع المبلغ
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={addManualRow}>
            <Plus className="h-4 w-4" aria-hidden />
            إضافة دفعة
          </Button>
        </div>

        {plannerOpen ? (
          <div className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className={erpLabelClass}>المبلغ الإجمالي</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={erpInputClass}
                  value={totalAmount}
                  disabled={disabled}
                  onChange={(e) => setTotalAmount(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">ينزل بصافي الفاتورة المتبقي ويمكن تعديله</p>
              </div>
              <div>
                <label className={erpLabelClass}>عدد الأقساط الدورية</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className={erpInputClass}
                  value={installmentCount}
                  disabled={disabled}
                  onChange={(e) => setInstallmentCount(e.target.value)}
                />
              </div>
              <div>
                <label className={erpLabelClass}>التكرار</label>
                <select
                  className={erpInputClass}
                  value={frequency}
                  disabled={disabled}
                  onChange={(e) => setFrequency(e.target.value as InstallmentFrequency)}
                >
                  {(Object.keys(INSTALLMENT_FREQUENCY_LABELS) as InstallmentFrequency[]).map((key) => (
                    <option key={key} value={key}>
                      {INSTALLMENT_FREQUENCY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={erpLabelClass}>تاريخ البداية الميلادي</label>
                <input
                  type="date"
                  className={erpInputClass}
                  value={planStartDate}
                  disabled={disabled}
                  onChange={(e) => setPlanStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className={erpLabelClass}>التاريخ الهجري</label>
                <input type="text" readOnly tabIndex={-1} className={`${erpInputClass} bg-slate-50`} value={plannerHijri} />
              </div>
              <div>
                <label className={erpLabelClass}>دفعة أولى (مقدم)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={erpInputClass}
                  placeholder="اختياري"
                  value={firstAmount}
                  disabled={disabled}
                  onChange={(e) => setFirstAmount(e.target.value)}
                />
              </div>
              <div>
                <label className={erpLabelClass}>دفعة أخيرة</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={erpInputClass}
                  placeholder="اختياري"
                  value={lastAmount}
                  disabled={disabled}
                  onChange={(e) => setLastAmount(e.target.value)}
                />
              </div>
              <div>
                <label className={erpLabelClass}>دفعة دورية</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className={`${erpInputClass} bg-slate-50 font-semibold text-[#0A3D5E]`}
                  value={formatInvoiceMoney(periodicPreview)}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  (الإجمالي − الأولى − الأخيرة) ÷ عدد الأقساط — لا تُضاف للدورية
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" disabled={disabled} onClick={applyDistribution}>
                تطبيق التوزيع
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className={erpTableHeadRowClass}>
                <th className={erpTableHeadCellClass}>رقم الدفعة</th>
                <th className={erpTableHeadCellClass}>تاريخ الاستحقاق</th>
                <th className={erpTableHeadCellClass}>التاريخ الهجري</th>
                <th className={erpTableHeadCellClass}>القيمة</th>
                <th className={erpTableHeadCellClass}>حذف</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    لا توجد دفعات — أضف دفعة يدوياً أو استخدم توزيع المبلغ
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-center tabular-nums">{row.number}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        className={erpInputClass}
                        value={row.dueDate}
                        disabled={disabled}
                        onChange={(e) => updateRow(row.id, { dueDate: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-600">{toHijriMedium(row.dueDate) || '—'}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={erpInputClass}
                        value={Number.isFinite(row.amount) ? row.amount : ''}
                        disabled={disabled}
                        onChange={(e) => updateRow(row.id, { amount: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        disabled={disabled}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
                        onClick={() => removeRow(row.id)}
                        aria-label={`حذف الدفعة ${row.number}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-slate-600">
            مجموع الدفعات:{' '}
            <strong className="text-[#0A3D5E]">{formatInvoiceMoney(rowsTotal)}</strong>
            {target > 0 ? (
              <>
                {' '}
                من {formatInvoiceMoney(target)}
                {Math.abs(difference) > 0.004 ? (
                  <span className="mr-2 text-amber-700">
                    فرق {formatInvoiceMoney(difference)}
                  </span>
                ) : (
                  <span className="mr-2 text-emerald-700">مطابق 100%</span>
                )}
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[#E6F0F7] px-5 py-3">
        <Button type="button" variant="secondary" size="sm" onClick={handleDone}>
          إغلاق
        </Button>
        <Button type="button" size="sm" onClick={handleDone} disabled={disabled}>
          حفظ الدفعات
        </Button>
      </div>
    </CenteredOverlay>
  );
}
