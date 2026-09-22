'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { erpInputClass } from '@/components/erp';
import {
  emptyChequeDraft,
  parseTenderAmount,
  type InvoiceChequeDraft,
} from '@/lib/invoices/cash-tender';

type Props = {
  open: boolean;
  onClose: () => void;
  netAmount: number;
  direction?: 'RECEIPT' | 'PAYMENT';
  variant?: 'full' | 'advance';
  bankAccountId: string;
  bankReference: string;
  chequeRows: InvoiceChequeDraft[];
  issuingBankAccountId?: string;
  paidAmount?: number;
  onConfirm: (next: {
    bankAccountId: string;
    bankReference: string;
    chequeRows: InvoiceChequeDraft[];
    issuingBankAccountId?: string;
    paidAmount?: number;
  }) => void;
};

export function CashBankChequeModal({
  open,
  onClose,
  netAmount,
  variant = 'full',
  bankAccountId,
  bankReference,
  chequeRows,
  issuingBankAccountId = '',
  onConfirm,
}: Props) {
  const [rows, setRows] = useState<InvoiceChequeDraft[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setRows(chequeRows.length ? chequeRows.map((row) => ({ ...row })) : [emptyChequeDraft()]);
    // Seed once when the dialog opens — parent chequeRows identity must not wipe typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chequeSum = useMemo(() => rows.reduce((sum, row) => sum + parseTenderAmount(row.amount), 0), [rows]);
  const leftover = Math.max(0, Number((netAmount - chequeSum).toFixed(2)));
  const advance = variant === 'advance';

  const save = () => {
    const completeCheques = rows.filter((row) => row.chequeNumber.trim() && parseTenderAmount(row.amount) > 0);
    if (!completeCheques.length) {
      setError('أدخل رقم الشيك والقيمة');
      return;
    }
    if (completeCheques.some((row) => !row.dueDate)) {
      setError('أدخل تاريخ استحقاق كل شيك');
      return;
    }
    if (!advance && netAmount > 0 && chequeSum + 0.009 < netAmount) {
      setError(
        `مجموع الشيكات (${chequeSum.toFixed(2)}) أقل من قيمة الفاتورة (${netAmount.toFixed(2)})`
      );
      return;
    }
    if (!advance && netAmount > 0 && chequeSum > netAmount + 0.009) {
      setError(
        `مجموع الشيكات (${chequeSum.toFixed(2)}) أكبر من قيمة الفاتورة (${netAmount.toFixed(2)})`
      );
      return;
    }
    if (advance && netAmount > 0 && chequeSum > netAmount + 0.009) {
      setError('القيمة أكبر من قيمة الفاتورة');
      return;
    }
    onConfirm({
      bankAccountId,
      bankReference,
      chequeRows: rows.length ? rows : [emptyChequeDraft()],
      issuingBankAccountId,
      paidAmount: chequeSum,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E6F0F7] bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-bold text-[#0A3D5E]">الشيكات</h2>
        <p className="mb-4 text-sm text-gray-600">
          قيمة الفاتورة:{' '}
          <strong>{netAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</strong>
        </p>

        {rows.map((row, index) => (
          <div key={row.id} className="mb-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-500">شيك {index + 1}</span>
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-medium text-rose-600 hover:underline"
                  onClick={() => setRows(rows.filter((item) => item.id !== row.id))}
                >
                  حذف
                </button>
              ) : null}
            </div>
            <input
              placeholder="رقم الشيك"
              className={erpInputClass}
              value={row.chequeNumber}
              onChange={(e) =>
                setRows(rows.map((item) => (item.id === row.id ? { ...item, chequeNumber: e.target.value } : item)))
              }
            />
            <input
              type="date"
              className={erpInputClass}
              value={row.dueDate}
              onChange={(e) =>
                setRows(rows.map((item) => (item.id === row.id ? { ...item, dueDate: e.target.value } : item)))
              }
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="القيمة"
              className={erpInputClass}
              value={row.amount}
              onChange={(e) =>
                setRows(rows.map((item) => (item.id === row.id ? { ...item, amount: e.target.value } : item)))
              }
            />
          </div>
        ))}

        <button
          type="button"
          className="mb-4 text-xs font-semibold text-[#0E78AA] hover:underline"
          onClick={() => setRows([...rows, emptyChequeDraft(leftover > 0 ? String(leftover) : '')])}
        >
          + إضافة شيك
        </button>

        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            advance
              ? chequeSum > netAmount + 0.009
                ? 'bg-rose-50 text-rose-900'
                : 'bg-slate-50 text-slate-800'
              : netAmount > 0 && Math.abs(chequeSum - netAmount) < 0.01
                ? 'bg-emerald-50 text-emerald-900'
                : 'bg-rose-50 text-rose-900'
          }`}
        >
          <div>المجموع: {chequeSum.toFixed(2)} ج.م</div>
          {!advance && leftover > 0.009 ? (
            <div className="mt-1 font-medium">ناقص عن الفاتورة: {leftover.toFixed(2)} ج.م</div>
          ) : null}
          {advance && leftover > 0.009 ? (
            <div className="mt-1">المتبقي آجل: {leftover.toFixed(2)} ج.م</div>
          ) : null}
        </div>

        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

        <ActionButtons onCancel={onClose} onSave={save} saveText="اعتماد" cancelText="إلغاء" />
      </div>
    </div>
  );
}
