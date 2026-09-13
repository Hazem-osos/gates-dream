'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import {
  CompactFormField,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { formatEgp, percentToRate, toMoney } from '@/lib/real-estate/format';
import type { UnitContract } from '@/lib/real-estate/types';

export function CancelContractModal({
  open,
  contract,
  onClose,
  onSaved,
}: {
  open: boolean;
  contract: UnitContract | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [ratePercent, setRatePercent] = useState('10');
  const [terms, setTerms] = useState<'HELD_UNTIL_RESALE' | 'IMMEDIATE_REFUND'>('HELD_UNTIL_RESALE');
  const [cancellationDate, setCancellationDate] = useState(new Date().toISOString().slice(0, 10));

  const preview = useMemo(() => {
    if (!contract) return { paid: 0, penalty: 0, refund: 0 };
    const paid = (contract.installments ?? []).reduce((sum, row) => sum + toMoney(row.paidAmount), 0);
    const selling = toMoney(contract.totalSellingPrice || contract.totalContractAmount);
    const penalty = selling * percentToRate(ratePercent);
    return { paid, penalty, refund: Math.max(0, paid - penalty) };
  }, [contract, ratePercent]);

  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/real-estate/contracts/${contract!.id}/cancel`, {
        cancellationDate,
        forfeiturePenaltyRate: percentToRate(ratePercent),
        refundDisbursementTerms: terms,
      }),
    onSuccess: () => {
      notifyApiSuccess('تم فسخ العقد ومصادرة المستحق');
      onSaved?.();
      onClose();
    },
  });

  if (!open || !contract) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="p-5 pb-0">
          <h2 className="mb-4 text-lg font-bold text-[#0E79AA]">فسخ العقد وتسوية المصادرة</h2>
          <ul className="mb-4 space-y-2 text-sm">
            <li className="flex justify-between"><span>إجمالي المدفوع من العميل (+)</span><strong>{formatEgp(preview.paid)}</strong></li>
            <li className="flex justify-between"><span>نسبة المصادرة ٪ (−)</span><strong>{ratePercent}٪</strong></li>
            <li className="flex justify-between text-red-700"><span>قيمة المصادرة (−)</span><strong>{formatEgp(preview.penalty)}</strong></li>
            <li className="flex justify-between font-bold text-emerald-700"><span>صافي المسترد (=)</span><strong>{formatEgp(preview.refund)}</strong></li>
          </ul>
          <FormSectionCard title="البيانات الأساسية" subtitle="نسبة المصادرة وتاريخ الفسخ وشروط الرد" icon={Ban} className="mb-3">
            <CompactFormField
              label="نسبة المصادرة"
              type="number"
              min="0"
              step="0.01"
              value={ratePercent}
              onChange={(e) => setRatePercent(e.target.value)}
            />
            <CompactFormField
              label="تاريخ الفسخ"
              type="date"
              value={cancellationDate}
              onChange={(e) => setCancellationDate(e.target.value)}
            />
            <CompactFormField label="شروط الرد">
              <select
                className={compactControlClass}
                value={terms}
                onChange={(e) => setTerms(e.target.value as typeof terms)}
              >
                <option value="HELD_UNTIL_RESALE">احتجاز حتى إعادة البيع</option>
                <option value="IMMEDIATE_REFUND">رد فوري</option>
              </select>
            </CompactFormField>
          </FormSectionCard>
          <p className="mb-3 text-xs text-slate-500">سيتم إلغاء الأقساط غير المحصّلة، إبطال الشيكات غير المحصّلة، وإعادة الوحدة إلى حالة متاحة.</p>
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={() => mutation.mutate()}
          saveText="تأكيد الفسخ"
          cancelText="إلغاء"
          saveLoading={mutation.isPending}
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
