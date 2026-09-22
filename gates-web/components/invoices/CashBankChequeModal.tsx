'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { BankSelect } from '@/app/components/form/BankSelect';
import { erpInputClass, erpLabelClass } from '@/components/erp';
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

function leftoverOf(netAmount: number, bankAmount: string, cheques: InvoiceChequeDraft[]): number {
  const used = parseTenderAmount(bankAmount) + cheques.reduce((sum, row) => sum + parseTenderAmount(row.amount), 0);
  return Math.max(0, Number((netAmount - used).toFixed(2)));
}

export function CashBankChequeModal({
  open,
  onClose,
  netAmount,
  direction = 'RECEIPT',
  variant = 'full',
  bankAccountId,
  bankReference,
  chequeRows,
  issuingBankAccountId = '',
  paidAmount = 0,
  onConfirm,
}: Props) {
  const [bankId, setBankId] = useState('');
  const [reference, setReference] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [issuingId, setIssuingId] = useState('');
  const [rows, setRows] = useState<InvoiceChequeDraft[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setBankId(bankAccountId);
    setReference(bankReference);
    setIssuingId(issuingBankAccountId);
    const seeded = chequeRows.length ? chequeRows.map((row) => ({ ...row })) : [emptyChequeDraft()];
    setRows(seeded);
    const chequeSum = seeded.reduce((sum, row) => sum + parseTenderAmount(row.amount), 0);
    if (variant === 'advance' && paidAmount > chequeSum) {
      setBankAmount(String(Number((paidAmount - chequeSum).toFixed(2))));
    } else if (variant === 'full' && netAmount > chequeSum && bankAccountId) {
      setBankAmount(String(Number((netAmount - chequeSum).toFixed(2))));
    } else {
      setBankAmount('');
    }
    // Seed once when the dialog opens — parent chequeRows identity must not wipe typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const leftover = leftoverOf(netAmount, bankAmount, rows);
  const chequeSum = useMemo(() => rows.reduce((sum, row) => sum + parseTenderAmount(row.amount), 0), [rows]);
  const advance = variant === 'advance';
  const resolvedBankAmount =
    parseTenderAmount(bankAmount) > 0
      ? parseTenderAmount(bankAmount)
      : bankId.trim() && chequeSum < 0.009 && !advance && netAmount > 0
        ? netAmount
        : 0;
  const allocated = resolvedBankAmount + chequeSum;

  const save = () => {
    const hasBank = Boolean(bankId.trim()) && resolvedBankAmount > 0;
    const completeCheques = rows.filter((row) => row.chequeNumber.trim() && parseTenderAmount(row.amount) > 0);
    if (!hasBank && !completeCheques.length) {
      setError('أضف تحويلاً بنكياً أو شيكاً واحداً على الأقل');
      return;
    }
    if (parseTenderAmount(bankAmount) > 0 && !bankId.trim()) {
      setError('اختر الحساب البنكي');
      return;
    }
    if (direction === 'PAYMENT' && completeCheques.some((row) => !row.bankAccountId.trim()) && !issuingId.trim()) {
      setError('حدد حساب البنك المصدر للشيكات');
      return;
    }
    if (!advance && netAmount > 0 && Math.abs(allocated - netAmount) > 0.009) {
      setError('يجب أن يساوي مجموع البنك والشيكات إجمالي الفاتورة');
      return;
    }
    if (advance && allocated > netAmount + 0.009) {
      setError('المجموع أكبر من إجمالي الفاتورة');
      return;
    }
    onConfirm({
      bankAccountId: bankId,
      bankReference: reference,
      chequeRows: rows.length ? rows : [emptyChequeDraft()],
      issuingBankAccountId: issuingId,
      paidAmount: allocated,
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E6F0F7] bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-bold text-[#0A3D5E]">بنك وشيكات</h2>
        <p className="mb-4 text-sm text-gray-600">
          يمكن الجمع بين تحويل بنكي وقائمة شيكات. الإجمالي:{' '}
          <strong>{netAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</strong>
        </p>

        <section className="mb-4 rounded-xl border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">بنك</h3>
          <div className="space-y-2">
            <BankSelect
              value={bankId}
              onChange={setBankId}
              placeholder="اختر الحساب البنكي"
              emptyLabel="اختر الحساب البنكي"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                placeholder="رقم العملية / المرجع"
                className={erpInputClass}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="المبلغ"
                className={erpInputClass}
                value={bankAmount}
                onChange={(e) => setBankAmount(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">قائمة شيكات</h3>
            <button
              type="button"
              className="text-xs font-semibold text-[#0E78AA] hover:underline"
              onClick={() => setRows([...rows, emptyChequeDraft(leftover > 0 ? String(leftover) : '')])}
            >
              + إضافة شيك
            </button>
          </div>
          {rows.map((row, index) => (
            <div key={row.id} className="mb-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2">
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  placeholder="رقم الشيك"
                  className={erpInputClass}
                  value={row.chequeNumber}
                  onChange={(e) =>
                    setRows(rows.map((item) => (item.id === row.id ? { ...item, chequeNumber: e.target.value } : item)))
                  }
                />
                <input
                  placeholder={direction === 'PAYMENT' ? 'بنك المستفيد' : 'بنك الساحب'}
                  className={erpInputClass}
                  value={row.bankName}
                  onChange={(e) =>
                    setRows(rows.map((item) => (item.id === row.id ? { ...item, bankName: e.target.value } : item)))
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
                  placeholder="مبلغ الشيك"
                  className={erpInputClass}
                  value={row.amount}
                  onChange={(e) =>
                    setRows(rows.map((item) => (item.id === row.id ? { ...item, amount: e.target.value } : item)))
                  }
                />
              </div>
              {direction === 'PAYMENT' ? (
                <div>
                  <label className={erpLabelClass}>حساب البنك المصدر</label>
                  <BankSelect
                    value={row.bankAccountId || issuingId}
                    onChange={(id) => {
                      setIssuingId(id);
                      setRows(rows.map((item) => (item.id === row.id ? { ...item, bankAccountId: id } : item)));
                    }}
                    placeholder="اختر حساب البنك"
                    emptyLabel="اختر حساب البنك"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            (!advance && netAmount > 0 && Math.abs(allocated - netAmount) < 0.01) ||
            (advance && allocated <= netAmount + 0.009)
              ? 'bg-emerald-50 text-emerald-900'
              : 'bg-rose-50 text-rose-900'
          }`}
        >
          <div>بنك: {parseTenderAmount(bankAmount).toFixed(2)} ج.م</div>
          <div>شيكات: {chequeSum.toFixed(2)} ج.م</div>
          {advance ? <div>آجل (متبقي): {leftover.toFixed(2)} ج.م</div> : null}
          {!advance && leftover > 0.009 ? <div className="mt-1 font-medium">غير موزّع: {leftover.toFixed(2)} ج.م</div> : null}
        </div>

        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

        <ActionButtons onCancel={onClose} onSave={save} saveText="اعتماد" cancelText="إلغاء" />
      </div>
    </div>
  );
}
