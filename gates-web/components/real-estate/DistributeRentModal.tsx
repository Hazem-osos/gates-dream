'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { formatEgp, percentToRate, rateToPercent, toMoney } from '@/lib/real-estate/format';
import type { RentalPoolAgreement } from '@/lib/real-estate/types';

export function DistributeRentModal({
  open,
  agreement,
  onClose,
  onSaved,
}: {
  open: boolean;
  agreement: RentalPoolAgreement | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const agreementRate = agreement ? rateToPercent(agreement.managementFeeRate) : 12;
  const [gross, setGross] = useState('');
  const [opex, setOpex] = useState('0');
  const [reserve, setReserve] = useState('0');
  const [feeRate, setFeeRate] = useState(String(agreementRate || 12));
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const live = useMemo(() => {
    const net = toMoney(gross) - toMoney(opex) - toMoney(reserve);
    const developer = Math.max(0, net) * percentToRate(feeRate);
    return { net, developer, owner: Math.max(0, net - developer) };
  }, [gross, opex, reserve, feeRate]);

  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/real-estate/rental-pools/${agreement!.id}/distribute`, {
        periodStart,
        periodEnd,
        grossRentCollected: toMoney(gross),
        operatingExpenses: toMoney(opex),
        maintenanceReserveDeduction: toMoney(reserve),
        managementFeeRate: percentToRate(feeRate),
      }),
    onSuccess: () => {
      notifyApiSuccess('تم توزيع الإيجار وترحيل القيد');
      onSaved?.();
      onClose();
    },
  });

  if (!open || !agreement) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-[#0E79AA]">توزيع إيجار المجمع التجاري</h2>
        <p className="text-sm text-slate-600">
          الوحدة {agreement.propertyUnit?.unitCode} — المالك {agreement.owner?.arabicName}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">إجمالي الإيجار المحصّل</span>
          <Input type="number" min="0" value={gross} onChange={(e) => setGross(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">المصروفات التشغيلية</span>
          <Input type="number" min="0" value={opex} onChange={(e) => setOpex(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">احتياطي الصيانة</span>
          <Input type="number" min="0" value={reserve} onChange={(e) => setReserve(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">أتعاب الإدارة ٪ (10–15)</span>
          <Input type="number" min="10" max="15" step="0.1" value={feeRate} onChange={(e) => setFeeRate(e.target.value)} />
        </label>
        <div className="rounded-xl bg-[#F6FBFD] p-3 text-sm">
          <p>صافي التشغيل: {formatEgp(live.net)}</p>
          <p>إيراد المطوّر: {formatEgp(live.developer)}</p>
          <p className="font-bold text-[#0E79AA]">صافي الموزّع للمالك: {formatEgp(live.owner)}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button isLoading={mutation.isPending} disabled={!gross || !periodStart || !periodEnd} onClick={() => mutation.mutate()}>
            ترحيل التوزيع
          </Button>
        </div>
      </div>
    </div>
  );
}
