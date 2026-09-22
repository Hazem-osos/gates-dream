'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiQuery } from '@/lib/hooks/useApi';
import { pickDefaultSafeId } from '@/lib/hooks/useMasterDataQueries';
import { SafeSelect } from '@/app/components/form/SafeSelect';
import { BankSelect } from '@/app/components/form/BankSelect';
import { erpInputClass, erpLabelClass } from '@/components/erp';
import {
  type PaymentSplitLine,
  splitsMatchTotal,
  sumPaymentSplits,
  buildSplitWithOnAccount,
} from '@/lib/invoices/payment-split.types';

type SafeRow = { id: string; arabicName: string; code?: string | null; isDefault?: boolean };

type CashDraft = { id: string; type: 'CASH'; safeId: string; amount: string };
type BankDraft = {
  id: string;
  type: 'BANK';
  bankAccountId: string;
  referenceNumber: string;
  amount: string;
};
type ChequeDraft = {
  id: string;
  type: 'CHEQUE';
  chequeNumber: string;
  bankName: string;
  dueDate: string;
  bankAccountId: string;
  amount: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  grandTotal: number;
  direction: 'RECEIPT' | 'PAYMENT';
  initial?: PaymentSplitLine[];
  onConfirm: (splits: PaymentSplitLine[]) => void;
};

const EMPTY_SAFES: SafeRow[] = [];

function parseAmount(s: string): number {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyCash(safeId = ''): CashDraft {
  return { id: newId('cash'), type: 'CASH', safeId, amount: '' };
}

function emptyBank(): BankDraft {
  return { id: newId('bank'), type: 'BANK', bankAccountId: '', referenceNumber: '', amount: '' };
}

function emptyCheque(amount = ''): ChequeDraft {
  return {
    id: newId('chq'),
    type: 'CHEQUE',
    chequeNumber: '',
    bankName: '',
    dueDate: new Date().toISOString().slice(0, 10),
    bankAccountId: '',
    amount,
  };
}

function leftoverOf(grandTotal: number, cash: CashDraft[], bank: BankDraft[], cheque: ChequeDraft[]): number {
  const used =
    cash.reduce((sum, row) => sum + parseAmount(row.amount), 0) +
    bank.reduce((sum, row) => sum + parseAmount(row.amount), 0) +
    cheque.reduce((sum, row) => sum + parseAmount(row.amount), 0);
  return Math.max(0, Number((grandTotal - used).toFixed(2)));
}

function leftoverHint(value: number): string {
  return value > 0 ? String(value) : '';
}

function draftsFromInitial(initial: PaymentSplitLine[] | undefined, defaultSafeId: string) {
  const cash: CashDraft[] = [];
  const bank: BankDraft[] = [];
  const cheque: ChequeDraft[] = [];
  for (const line of initial ?? []) {
    if (line.type === 'CASH') {
      cash.push({ id: newId('cash'), type: 'CASH', safeId: line.safeId, amount: String(line.amount) });
    } else if (line.type === 'BANK') {
      bank.push({
        id: newId('bank'),
        type: 'BANK',
        bankAccountId: line.bankAccountId,
        referenceNumber: line.referenceNumber ?? '',
        amount: String(line.amount),
      });
    } else if (line.type === 'CHEQUE') {
      cheque.push({
        id: newId('chq'),
        type: 'CHEQUE',
        chequeNumber: line.chequeNumber,
        bankName: line.bankName === '—' ? '' : line.bankName,
        dueDate: String(line.dueDate).slice(0, 10),
        bankAccountId: line.bankAccountId ?? '',
        amount: String(line.amount),
      });
    }
  }
  if (!cash.length) cash.push(emptyCash(defaultSafeId));
  if (!bank.length) bank.push(emptyBank());
  if (!cheque.length) cheque.push(emptyCheque());
  return { cash, bank, cheque };
}

export function MultiPaymentSplitterModal({
  open,
  onClose,
  grandTotal,
  direction,
  initial,
  onConfirm,
}: Props) {
  const [cashRows, setCashRows] = useState<CashDraft[]>([]);
  const [bankRows, setBankRows] = useState<BankDraft[]>([]);
  const [chequeRows, setChequeRows] = useState<ChequeDraft[]>([]);
  const [error, setError] = useState('');

  const { data: safesRes } = useApiQuery<SafeRow[]>(
    ['safes', 'split'],
    '/accounting/safes',
    { limit: 200, isActive: true },
    { enabled: open }
  );
  const safes = safesRes?.data ?? EMPTY_SAFES;
  const defaultSafeId = pickDefaultSafeId(safes) ?? '';

  useEffect(() => {
    if (!open) return;
    setError('');
    const { cash, bank, cheque } = draftsFromInitial(initial, defaultSafeId);
    setCashRows(cash);
    setBankRows(bank);
    setChequeRows(cheque);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on open only
  }, [open]);

  useEffect(() => {
    if (!open || !defaultSafeId) return;
    setCashRows((prev) => {
      if (!prev.some((row) => !row.safeId)) return prev;
      return prev.map((row) => (row.safeId ? row : { ...row, safeId: defaultSafeId }));
    });
  }, [open, defaultSafeId]);

  const leftover = leftoverOf(grandTotal, cashRows, bankRows, chequeRows);

  const builtLines = useMemo((): PaymentSplitLine[] => {
    const out: Exclude<PaymentSplitLine, { type: 'ON_ACCOUNT' }>[] = [];
    for (const row of cashRows) {
      const amount = parseAmount(row.amount);
      if (amount > 0 && row.safeId) out.push({ type: 'CASH', safeId: row.safeId, amount });
    }
    for (const row of bankRows) {
      const amount = parseAmount(row.amount);
      if (amount > 0 && row.bankAccountId) {
        out.push({
          type: 'BANK',
          bankAccountId: row.bankAccountId,
          referenceNumber: row.referenceNumber.trim() || undefined,
          amount,
        });
      }
    }
    for (const row of chequeRows) {
      const amount = parseAmount(row.amount);
      if (amount > 0 && row.chequeNumber.trim()) {
        out.push({
          type: 'CHEQUE',
          chequeNumber: row.chequeNumber.trim(),
          bankName: row.bankName.trim() || '—',
          dueDate: row.dueDate || new Date().toISOString().slice(0, 10),
          bankAccountId: row.bankAccountId || undefined,
          amount,
        });
      }
    }
    return buildSplitWithOnAccount(out, grandTotal);
  }, [cashRows, bankRows, chequeRows, grandTotal]);

  const allocated = sumPaymentSplits(builtLines.filter((line) => line.type !== 'ON_ACCOUNT'));
  const onAccount = builtLines.find((line) => line.type === 'ON_ACCOUNT')?.amount ?? 0;
  const remaining = grandTotal - allocated - onAccount;
  const valid = splitsMatchTotal(builtLines, grandTotal);

  const save = () => {
    if (!valid) {
      setError('يجب أن يساوي مجموع التوزيع إجمالي الفاتورة');
      return;
    }
    onConfirm(builtLines);
    onClose();
  };

  if (!open) return null;

  const title = direction === 'RECEIPT' ? 'توزيع تحصيل متعدد' : 'توزيع دفع متعدد';

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E6F0F7] bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-bold text-[#0A3D5E]">{title}</h2>
        <p className="mb-4 text-sm text-gray-600">
          يمكن الجمع بين نقدي وبنك وقائمة شيكات. الإجمالي:{' '}
          <strong>{grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</strong>
        </p>

        <section className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">نقدي</h3>
            <button
              type="button"
              className="text-xs font-semibold text-[#0E78AA] hover:underline"
              onClick={() => setCashRows([...cashRows, { ...emptyCash(defaultSafeId), amount: leftoverHint(leftover) }])}
            >
              + سطر نقدي
            </button>
          </div>
          {cashRows.map((row) => (
            <div key={row.id} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_auto]">
              <SafeSelect
                value={row.safeId}
                onChange={(safeId) =>
                  setCashRows(cashRows.map((item) => (item.id === row.id ? { ...item, safeId } : item)))
                }
                safes={safes}
                placeholder="اختر الخزينة"
                emptyLabel="اختر الخزينة"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="المبلغ"
                className={erpInputClass}
                value={row.amount}
                onChange={(e) =>
                  setCashRows(cashRows.map((item) => (item.id === row.id ? { ...item, amount: e.target.value } : item)))
                }
              />
              {cashRows.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-medium text-rose-600 hover:underline"
                  onClick={() => setCashRows(cashRows.filter((item) => item.id !== row.id))}
                >
                  حذف
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </section>

        <section className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">بنك</h3>
            <button
              type="button"
              className="text-xs font-semibold text-[#0E78AA] hover:underline"
              onClick={() => setBankRows([...bankRows, { ...emptyBank(), amount: leftoverHint(leftover) }])}
            >
              + تحويل بنكي
            </button>
          </div>
          {bankRows.map((row) => (
            <div key={row.id} className="mb-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">تحويل بنكي</span>
                {bankRows.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-600 hover:underline"
                    onClick={() => setBankRows(bankRows.filter((item) => item.id !== row.id))}
                  >
                    حذف
                  </button>
                ) : null}
              </div>
              <BankSelect
                value={row.bankAccountId}
                onChange={(bankAccountId) =>
                  setBankRows(bankRows.map((item) => (item.id === row.id ? { ...item, bankAccountId } : item)))
                }
                placeholder="اختر الحساب البنكي"
                emptyLabel="اختر الحساب البنكي"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  placeholder="رقم العملية / المرجع"
                  className={erpInputClass}
                  value={row.referenceNumber}
                  onChange={(e) =>
                    setBankRows(
                      bankRows.map((item) => (item.id === row.id ? { ...item, referenceNumber: e.target.value } : item))
                    )
                  }
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="المبلغ"
                  className={erpInputClass}
                  value={row.amount}
                  onChange={(e) =>
                    setBankRows(bankRows.map((item) => (item.id === row.id ? { ...item, amount: e.target.value } : item)))
                  }
                />
              </div>
            </div>
          ))}
        </section>

        <section className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">قائمة شيكات</h3>
            <button
              type="button"
              className="text-xs font-semibold text-[#0E78AA] hover:underline"
              onClick={() => setChequeRows([...chequeRows, emptyCheque(leftoverHint(leftover))])}
            >
              + إضافة شيك
            </button>
          </div>
          {chequeRows.map((row, index) => (
            <div key={row.id} className="mb-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">شيك {index + 1}</span>
                {chequeRows.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-600 hover:underline"
                    onClick={() => setChequeRows(chequeRows.filter((item) => item.id !== row.id))}
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
                    setChequeRows(
                      chequeRows.map((item) => (item.id === row.id ? { ...item, chequeNumber: e.target.value } : item))
                    )
                  }
                />
                <input
                  placeholder={direction === 'PAYMENT' ? 'بنك المستفيد' : 'بنك الساحب'}
                  className={erpInputClass}
                  value={row.bankName}
                  onChange={(e) =>
                    setChequeRows(
                      chequeRows.map((item) => (item.id === row.id ? { ...item, bankName: e.target.value } : item))
                    )
                  }
                />
                <input
                  type="date"
                  className={erpInputClass}
                  value={row.dueDate}
                  onChange={(e) =>
                    setChequeRows(
                      chequeRows.map((item) => (item.id === row.id ? { ...item, dueDate: e.target.value } : item))
                    )
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
                    setChequeRows(
                      chequeRows.map((item) => (item.id === row.id ? { ...item, amount: e.target.value } : item))
                    )
                  }
                />
              </div>
              {direction === 'PAYMENT' ? (
                <div>
                  <label className={erpLabelClass}>حساب البنك المصدر</label>
                  <BankSelect
                    value={row.bankAccountId}
                    onChange={(bankAccountId) =>
                      setChequeRows(
                        chequeRows.map((item) => (item.id === row.id ? { ...item, bankAccountId } : item))
                      )
                    }
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
            valid ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'
          }`}
        >
          <div>موزّع: {allocated.toFixed(2)} ج.م</div>
          <div>آجل (متبقي): {onAccount.toFixed(2)} ج.م</div>
          {!valid ? (
            <div className="mt-1 font-medium">غير موزّع: {remaining.toFixed(2)} ج.م — يجب أن يصبح 0</div>
          ) : (
            <div className="mt-1 font-medium">✓ التوزيع مكتمل</div>
          )}
        </div>

        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

        <ActionButtons onCancel={onClose} onSave={save} saveText="اعتماد التوزيع" cancelText="إلغاء" />
      </div>
    </div>
  );
}
