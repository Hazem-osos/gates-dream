'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiQuery } from '@/lib/hooks/useApi';
import { pickDefaultSafeId } from '@/lib/hooks/useMasterDataQueries';
import {
  type PaymentSplitLine,
  splitsMatchTotal,
  sumPaymentSplits,
  buildSplitWithOnAccount,
} from '@/lib/invoices/payment-split.types';

type SafeRow = { id: string; arabicName: string; code?: string | null; isDefault?: boolean };
type BankRow = {
  id: string;
  accountNumber: string;
  bank?: { arabicName?: string };
};

type CashDraft = { type: 'CASH'; safeId: string; amount: string };
type BankDraft = {
  type: 'BANK';
  bankAccountId: string;
  referenceNumber: string;
  amount: string;
};
type ChequeDraft = {
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
const EMPTY_BANKS: BankRow[] = [];

function parseAmount(s: string): number {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function draftsFromInitial(initial: PaymentSplitLine[] | undefined, defaultSafeId: string) {
  const cash: CashDraft[] = [];
  const bank: BankDraft[] = [];
  const cheque: ChequeDraft[] = [];
  for (const line of initial ?? []) {
    if (line.type === 'CASH') {
      cash.push({ type: 'CASH', safeId: line.safeId, amount: String(line.amount) });
    } else if (line.type === 'BANK') {
      bank.push({
        type: 'BANK',
        bankAccountId: line.bankAccountId,
        referenceNumber: line.referenceNumber ?? '',
        amount: String(line.amount),
      });
    } else if (line.type === 'CHEQUE') {
      cheque.push({
        type: 'CHEQUE',
        chequeNumber: line.chequeNumber,
        bankName: line.bankName,
        dueDate: line.dueDate.slice(0, 10),
        bankAccountId: line.bankAccountId ?? '',
        amount: String(line.amount),
      });
    }
  }
  if (!cash.length) {
    cash.push({ type: 'CASH', safeId: defaultSafeId, amount: '' });
  }
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
  const { data: banksRes } = useApiQuery<BankRow[]>(
    ['banks-split'],
    '/accounting/bank-accounts',
    { limit: 200, isActive: true },
    { enabled: open }
  );
  const safes = safesRes?.data ?? EMPTY_SAFES;
  const banks = banksRes?.data ?? EMPTY_BANKS;
  const defaultSafeId = pickDefaultSafeId(safes) ?? '';

  // Seed drafts when the modal opens (not on every safes[] identity change).
  useEffect(() => {
    if (!open) return;
    setError('');
    const { cash, bank, cheque } = draftsFromInitial(initial, defaultSafeId);
    setCashRows(cash);
    setBankRows(bank);
    setChequeRows(cheque);
    // intentionally omit `initial` content churn while open — parent keeps paymentSplits stable
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on open only
  }, [open]);

  // When safes finish loading after open, fill blank safe pickers once.
  useEffect(() => {
    if (!open || !defaultSafeId) return;
    setCashRows((prev) => {
      if (!prev.some((r) => !r.safeId)) return prev;
      return prev.map((r) => (r.safeId ? r : { ...r, safeId: defaultSafeId }));
    });
  }, [open, defaultSafeId]);

  const builtLines = useMemo((): PaymentSplitLine[] => {
    const out: Exclude<PaymentSplitLine, { type: 'ON_ACCOUNT' }>[] = [];
    for (const r of cashRows) {
      if (r.type !== 'CASH') continue;
      const amount = parseAmount(r.amount);
      if (amount > 0 && r.safeId) out.push({ type: 'CASH', safeId: r.safeId, amount });
    }
    for (const r of bankRows) {
      if (r.type !== 'BANK') continue;
      const amount = parseAmount(r.amount);
      if (amount > 0 && r.bankAccountId) {
        out.push({
          type: 'BANK',
          bankAccountId: r.bankAccountId,
          referenceNumber: r.referenceNumber.trim() || undefined,
          amount,
        });
      }
    }
    for (const r of chequeRows) {
      if (r.type !== 'CHEQUE') continue;
      const amount = parseAmount(r.amount);
      if (amount > 0 && r.chequeNumber.trim()) {
        out.push({
          type: 'CHEQUE',
          chequeNumber: r.chequeNumber.trim(),
          bankName: r.bankName.trim() || '—',
          dueDate: r.dueDate || new Date().toISOString().slice(0, 10),
          bankAccountId: r.bankAccountId || undefined,
          amount,
        });
      }
    }
    return buildSplitWithOnAccount(out, grandTotal);
  }, [cashRows, bankRows, chequeRows, grandTotal]);

  const allocated = sumPaymentSplits(builtLines.filter((l) => l.type !== 'ON_ACCOUNT'));
  const onAccount = builtLines.find((l) => l.type === 'ON_ACCOUNT')?.amount ?? 0;
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
          الإجمالي:{' '}
          <strong>{grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</strong>
        </p>

        <section className="mb-4 rounded-xl border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">نقدية</h3>
          {cashRows.map((row, i) => (
            <div key={i} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                className="rounded-lg border border-gray-300 p-2 text-sm"
                value={row.safeId}
                onChange={(e) => {
                  const next = [...cashRows];
                  next[i] = { type: 'CASH', safeId: e.target.value, amount: row.amount };
                  setCashRows(next);
                }}
              >
                <option value="">اختر الخزينة</option>
                {safes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.arabicName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="المبلغ"
                className="rounded-lg border border-gray-300 p-2 text-sm"
                value={row.amount}
                onChange={(e) => {
                  const next = [...cashRows];
                  next[i] = { type: 'CASH', safeId: row.safeId, amount: e.target.value };
                  setCashRows(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-[#0E78AA]"
            onClick={() =>
              setCashRows([...cashRows, { type: 'CASH', safeId: pickDefaultSafeId(safes) ?? '', amount: '' }])
            }
          >
            + سطر نقدية
          </button>
        </section>

        <section className="mb-4 rounded-xl border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">تحويل بنكي / إنستاباي</h3>
          {bankRows.length === 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-[#0E78AA]"
              onClick={() =>
                setBankRows([
                  {
                    type: 'BANK',
                    bankAccountId: banks[0]?.id ?? '',
                    referenceNumber: '',
                    amount: '',
                  },
                ])
              }
            >
              + إضافة تحويل بنكي
            </button>
          ) : (
            bankRows.map((row, i) => (
              <div key={i} className="mb-2 space-y-2">
                <select
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                  value={row.bankAccountId}
                  onChange={(e) => {
                    const next = [...bankRows];
                    next[i] = { ...row, bankAccountId: e.target.value };
                    setBankRows(next);
                  }}
                >
                  <option value="">حساب بنكي</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank?.arabicName ?? ''} — {b.accountNumber}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    placeholder="رقم العملية / المرجع"
                    className="rounded-lg border border-gray-300 p-2 text-sm"
                    value={row.referenceNumber}
                    onChange={(e) => {
                      const next = [...bankRows];
                      next[i] = { ...row, referenceNumber: e.target.value };
                      setBankRows(next);
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="المبلغ"
                    className="rounded-lg border border-gray-300 p-2 text-sm"
                    value={row.amount}
                    onChange={(e) => {
                      const next = [...bankRows];
                      next[i] = { ...row, amount: e.target.value };
                      setBankRows(next);
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </section>

        <section className="mb-4 rounded-xl border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">شيك بنكي</h3>
          {chequeRows.length === 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-[#0E78AA]"
              onClick={() =>
                setChequeRows([
                  {
                    type: 'CHEQUE',
                    chequeNumber: '',
                    bankName: '',
                    dueDate: new Date().toISOString().slice(0, 10),
                    bankAccountId: banks[0]?.id ?? '',
                    amount: '',
                  },
                ])
              }
            >
              + إضافة شيك
            </button>
          ) : (
            chequeRows.map((row, i) => (
              <div key={i} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  placeholder="رقم الشيك"
                  className="rounded-lg border border-gray-300 p-2 text-sm"
                  value={row.chequeNumber}
                  onChange={(e) => {
                    const next = [...chequeRows];
                    next[i] = { ...row, chequeNumber: e.target.value };
                    setChequeRows(next);
                  }}
                />
                <input
                  placeholder="اسم البنك"
                  className="rounded-lg border border-gray-300 p-2 text-sm"
                  value={row.bankName}
                  onChange={(e) => {
                    const next = [...chequeRows];
                    next[i] = { ...row, bankName: e.target.value };
                    setChequeRows(next);
                  }}
                />
                <input
                  type="date"
                  className="rounded-lg border border-gray-300 p-2 text-sm"
                  value={row.dueDate}
                  onChange={(e) => {
                    const next = [...chequeRows];
                    next[i] = { ...row, dueDate: e.target.value };
                    setChequeRows(next);
                  }}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="مبلغ الشيك"
                  className="rounded-lg border border-gray-300 p-2 text-sm"
                  value={row.amount}
                  onChange={(e) => {
                    const next = [...chequeRows];
                    next[i] = { ...row, amount: e.target.value };
                    setChequeRows(next);
                  }}
                />
                {direction === 'PAYMENT' ? (
                  <select
                    className="sm:col-span-2 rounded-lg border border-gray-300 p-2 text-sm"
                    value={row.bankAccountId}
                    onChange={(e) => {
                      const next = [...chequeRows];
                      next[i] = { ...row, bankAccountId: e.target.value };
                      setChequeRows(next);
                    }}
                  >
                    <option value="">حساب بنك للإصدار</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank?.arabicName ?? ''} — {b.accountNumber}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ))
          )}
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
