'use client';

import { useEffect, useMemo, useState } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { Button } from '@/components/ui';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { toHijri } from '@/lib/dates/hijri';
import type { SecuritiesPaperKind } from './securities-paper-status';

export type MultiCollectionHistoryRow = {
  id?: string;
  accountId?: string | null;
  amount?: number | string | null;
  collectionDate?: string | Date | null;
  account?: { code?: string | null; arabicName?: string | null } | null;
};

export type MultiCollectionPayload = {
  collectionDate: string;
  hijriDate?: string;
  accountId: string;
  amount: number;
};

type Props = {
  open: boolean;
  kind: SecuritiesPaperKind;
  paperNumber?: string;
  remainingAmount: number;
  currencyCode?: string;
  disabled?: boolean;
  confirmPending?: boolean;
  existingLines?: MultiCollectionHistoryRow[];
  onClose: () => void;
  onConfirm: (payload: MultiCollectionPayload) => Promise<void> | void;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function money(value: number, currencyCode = 'EGP') {
  return `${value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode === 'EGP' ? 'ج.م' : currencyCode}`;
}

function isoDate(value?: string | Date | null) {
  if (!value) return '—';
  const raw = typeof value === 'string' ? value : value.toISOString();
  return raw.slice(0, 10);
}

function accountLabel(row: MultiCollectionHistoryRow) {
  const name = row.account?.arabicName || '';
  const code = row.account?.code || '';
  return [code, name].filter(Boolean).join(' — ') || '—';
}

export function MultiCollectionModal({
  open,
  paperNumber,
  remainingAmount,
  currencyCode = 'EGP',
  disabled,
  confirmPending,
  existingLines = [],
  onClose,
  onConfirm,
}: Props) {
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [collectionDate, setCollectionDate] = useState(todayIso());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAccountId('');
    setAmount('');
    setCollectionDate(todayIso());
    setError('');
  }, [open]);

  const amountNum = Number(String(amount).replace(/,/g, '')) || 0;
  const remaining = Math.max(0, Math.round(remainingAmount * 100) / 100);
  const canSave = !disabled && remaining > 0.009;

  const history = useMemo(
    () =>
      existingLines.map((row) => ({
        ...row,
        amountNum: Number(row.amount) || 0,
      })),
    [existingLines]
  );

  const submit = async () => {
    if (!canSave) {
      setError('لا يوجد رصيد متبقٍ للتحصيل');
      return;
    }
    if (!collectionDate) {
      setError('أدخل تاريخ التحصيل');
      return;
    }
    if (!accountId) {
      setError('اختر الحساب');
      return;
    }
    if (!(amountNum > 0)) {
      setError('أدخل القيمة');
      return;
    }
    if (amountNum - remaining > 0.009) {
      setError('القيمة تتجاوز الرصيد المتبقي');
      return;
    }
    setError('');
    await onConfirm({
      collectionDate,
      hijriDate: toHijri(collectionDate),
      accountId,
      amount: Math.round(amountNum * 100) / 100,
    });
    setAccountId('');
    setAmount('');
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="lg" labelledBy="multi-collection-title">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xl" dir="rtl">
        <div className="mb-4">
          <h2 id="multi-collection-title" className="text-base font-bold text-foreground">
            تحصيل متعدد
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {paperNumber ? `ورقة ${paperNumber} — ` : ''}
            الرصيد المتبقي: {money(remaining, currencyCode)}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/40 p-3 md:grid-cols-3">
          <DatePickerWithHijri
            label="التاريخ"
            value={collectionDate}
            onChange={setCollectionDate}
            required
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">الحساب</label>
            <AccountSelect
              value={accountId}
              onChange={setAccountId}
              leafOnly
              disabled={disabled || !canSave}
              emptyLabel="اختر الحساب"
              placeholder="اختر الحساب"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">القيمة</label>
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={disabled || !canSave}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-end font-mono text-xs"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#D6EAF3]">
          <table className="w-full text-center text-xs">
            <thead className="bg-[#F6FBFD] text-[#094C6B]">
              <tr>
                <th className="px-3 py-2 font-bold">التاريخ</th>
                <th className="px-3 py-2 font-bold">الحساب</th>
                <th className="px-3 py-2 font-bold">القيمة</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-slate-500">
                    لا توجد تحصيلات جزئية بعد
                  </td>
                </tr>
              ) : (
                history.map((row, index) => (
                  <tr key={row.id || `${isoDate(row.collectionDate)}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-[#F6FBFD]'}>
                    <td className="border-t border-[#D6EAF3] px-3 py-2 font-mono">{isoDate(row.collectionDate)}</td>
                    <td className="border-t border-[#D6EAF3] px-3 py-2">{accountLabel(row)}</td>
                    <td className="border-t border-[#D6EAF3] px-3 py-2 font-mono">
                      {money(row.amountNum, currencyCode)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            إغلاق
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!canSave || confirmPending}
            onClick={() => void submit()}
          >
            {confirmPending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </div>
      </div>
    </CenteredOverlay>
  );
}
