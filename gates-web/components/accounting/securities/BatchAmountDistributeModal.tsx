'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { toHijriDate } from '@/lib/hijri-date';
import { roundInstallmentMoney } from '@/lib/invoices/payment-installments';

export type DistributedPaperRow = {
  amount: number;
  dueDate: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultAmount?: number;
  defaultStartDate?: string;
  onApply: (rows: DistributedPaperRow[]) => void;
};

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function BatchAmountDistributeModal({
  open,
  onClose,
  defaultAmount = 0,
  defaultStartDate,
  onApply,
}: Props) {
  const [totalAmount, setTotalAmount] = useState('');
  const [paperCount, setPaperCount] = useState('3');
  const [intervalDays, setIntervalDays] = useState('30');
  const [startDate, setStartDate] = useState(defaultStartDate || todayIso());
  const [firstAmount, setFirstAmount] = useState('');
  const [lastAmount, setLastAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTotalAmount(defaultAmount > 0 ? String(roundInstallmentMoney(defaultAmount)) : '');
    setPaperCount('3');
    setIntervalDays('30');
    setStartDate(defaultStartDate || todayIso());
    setFirstAmount('');
    setLastAmount('');
    setError('');
  }, [open, defaultAmount, defaultStartDate]);

  const periodicPreview = useMemo(() => {
    const total = Number(totalAmount) || 0;
    const count = Math.floor(Number(paperCount) || 0);
    const first = firstAmount === '' ? 0 : Number(firstAmount) || 0;
    const last = lastAmount === '' ? 0 : Number(lastAmount) || 0;
    if (count < 1) return 0;
    const reservedEnds = (first > 0 ? 1 : 0) + (last > 0 && count > 1 ? 1 : 0);
    const middle = Math.max(count - reservedEnds, 0);
    if (middle <= 0) return 0;
    return Math.max(0, roundInstallmentMoney((total - first - last) / middle));
  }, [totalAmount, paperCount, firstAmount, lastAmount]);

  const apply = () => {
    try {
      const total = roundInstallmentMoney(Number(totalAmount) || 0);
      const count = Math.floor(Number(paperCount) || 0);
      const days = Math.max(1, Math.floor(Number(intervalDays) || 0));
      const first = firstAmount === '' ? 0 : roundInstallmentMoney(Number(firstAmount) || 0);
      const last = lastAmount === '' ? 0 : roundInstallmentMoney(Number(lastAmount) || 0);
      if (total <= 0) throw new Error('أدخل المبلغ الإجمالي');
      if (count < 1) throw new Error('عدد الأوراق يجب أن يكون 1 على الأقل');
      if (!startDate) throw new Error('حدد تاريخ البداية');
      if (first + last - total > 0.005) throw new Error('الدفعة الأولى والأخيرة أكبر من الإجمالي');

      const amounts = new Array(count).fill(0);
      const useFirst = first > 0;
      const useLast = last > 0 && count > 1;
      if (useFirst) amounts[0] = first;
      if (useLast) amounts[count - 1] = last;
      const middleStart = useFirst ? 1 : 0;
      const middleEnd = useLast ? count - 2 : count - 1;
      const middleCount = middleEnd - middleStart + 1;
      const leftover = roundInstallmentMoney(total - (useFirst ? first : 0) - (useLast ? last : 0));
      if (middleCount <= 0) {
        if (count === 1) amounts[0] = total;
      } else {
        const unit = roundInstallmentMoney(leftover / middleCount);
        for (let i = middleStart; i <= middleEnd; i += 1) amounts[i] = unit;
        const used = amounts.reduce((sum, value, index) => (index === middleEnd ? sum : sum + value), 0);
        amounts[middleEnd] = roundInstallmentMoney(total - used);
        if (amounts[middleEnd] < -0.005) throw new Error('تعذر توزيع المتبقي على الأوراق');
      }

      onApply(
        amounts.map((amount, index) => ({
          amount,
          dueDate: addDays(startDate, index * days),
        }))
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر توزيع المبالغ');
    }
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="batch-distribute-title">
      <div className="relative shrink-0 bg-gradient-to-l from-[#0E78AA] to-[#1E88E5] px-5 py-4">
        <h2 id="batch-distribute-title" className="text-center text-lg font-bold text-white">
          توزيع المبالغ
        </h2>
        <button
          type="button"
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/90 hover:bg-white/10"
          onClick={onClose}
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-600">
          وزّع إجمالي المبلغ على عدة أوراق بتواريخ استحقاق متتابعة، ثم تتعبّى في جدول الإدخال.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={erpLabelClass}>المبلغ الإجمالي</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={erpInputClass}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>
          <div>
            <label className={erpLabelClass}>عدد الأوراق</label>
            <input
              type="number"
              min="1"
              step="1"
              className={erpInputClass}
              value={paperCount}
              onChange={(e) => setPaperCount(e.target.value)}
            />
          </div>
          <div>
            <label className={erpLabelClass}>كل كم يوم</label>
            <input
              type="number"
              min="1"
              step="1"
              className={erpInputClass}
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
            />
          </div>
          <div>
            <label className={erpLabelClass}>بدء من</label>
            <input
              type="date"
              className={erpInputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {startDate ? (
              <p className="mt-1 text-[11px] font-medium text-emerald-700">{toHijriDate(startDate)}</p>
            ) : null}
          </div>
          <div>
            <label className={erpLabelClass}>دفعة أولى (اختياري)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={erpInputClass}
              value={firstAmount}
              onChange={(e) => setFirstAmount(e.target.value)}
              placeholder="بدون"
            />
          </div>
          <div>
            <label className={erpLabelClass}>دفعة أخيرة (اختياري)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={erpInputClass}
              value={lastAmount}
              onChange={(e) => setLastAmount(e.target.value)}
              placeholder="بدون"
            />
          </div>
        </div>
        <p className="rounded-lg bg-[#F6FBFD] px-3 py-2 text-sm text-[#094C6B]">
          الدفعة الدورية التقريبية:{' '}
          <span className="font-mono font-semibold">
            {periodicPreview.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
          </span>
        </p>
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[#D6EAF3] px-5 py-3">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          تراجع
        </Button>
        <Button type="button" size="sm" onClick={apply}>
          تطبيق التوزيع
        </Button>
      </div>
    </CenteredOverlay>
  );
}
