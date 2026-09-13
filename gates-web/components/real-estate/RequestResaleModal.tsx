'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { useCustomersQuery } from '@/lib/hooks/useMasterDataQueries';
import { formatEgp, percentToRate, toMoney } from '@/lib/real-estate/format';
import type { UnitContractListItem } from '@/lib/real-estate/types';

export function RequestResaleModal({
  open,
  contracts,
  defaultContractId,
  onClose,
  onSaved,
}: {
  open: boolean;
  contracts: UnitContractListItem[];
  defaultContractId?: string;
  onClose: () => void;
  onSaved?: (transferId?: string) => void;
}) {
  const [contractId, setContractId] = useState(defaultContractId ?? '');
  const [buyerId, setBuyerId] = useState('');
  const [marketValue, setMarketValue] = useState('');
  const [feeRate, setFeeRate] = useState('5');
  const { data: customersRes } = useCustomersQuery(400);
  const customers = customersRes?.data ?? [];
  const fee = useMemo(() => toMoney(marketValue) * percentToRate(feeRate), [marketValue, feeRate]);

  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.post<{ transfer?: { id: string } }>(`/real-estate/contracts/${contractId}/resale-request`, {
        newBuyerCustomerId: buyerId,
        currentUnitMarketValue: toMoney(marketValue),
        assignmentFeeRate: percentToRate(feeRate),
      }),
    onSuccess: (res) => {
      notifyApiSuccess('تم تسجيل طلب إعادة البيع');
      onSaved?.(res.data?.transfer?.id);
      onClose();
    },
  });

  if (!open) return null;

  const advancedFilledCount = [feeRate !== '5' ? feeRate : ''].filter((v) => v.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="p-5 pb-0">
          <h2 className="mb-4 text-lg font-bold text-[#0E79AA]">طلب إعادة بيع / تنازل</h2>
          <FormSectionCard title="البيانات الأساسية" subtitle="العقد الحالي والمشتري والتقييم" icon={ArrowLeftRight} className="mb-3">
            <CompactFormField label="العقد الحالي" className="sm:col-span-2 lg:col-span-3">
              <select className={compactControlClass} value={contractId} onChange={(e) => setContractId(e.target.value)}>
                <option value="">اختر العقد</option>
                {contracts.filter((row) => row.status === 'ACTIVE').map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.contractNumber} — {row.unit?.unitCode} — {row.customer?.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField label="المشتري الجديد" className="sm:col-span-2 lg:col-span-3">
              <select className={compactControlClass} value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                <option value="">اختر العميل</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.arabicName} {customer.code ? `— ${customer.code}` : ''}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField
              label="التقييم السوقي الحالي"
              type="number"
              min="0"
              value={marketValue}
              onChange={(e) => setMarketValue(e.target.value)}
            />
          </FormSectionCard>
          <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CompactFormField
                label="نسبة رسوم التنازل ٪"
                type="number"
                min="0"
                step="0.01"
                value={feeRate}
                onChange={(e) => setFeeRate(e.target.value)}
              />
            </div>
          </AdvancedFieldsSection>
          <p className="mb-3 rounded-lg bg-[#F6FBFD] px-3 py-2 text-sm font-bold text-[#0E79AA]">رسوم التنازل المحسوبة: {formatEgp(fee)}</p>
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={() => mutation.mutate()}
          saveText="تسجيل الطلب"
          cancelText="إلغاء"
          saveLoading={mutation.isPending}
          saveDisabled={!contractId || !buyerId || !marketValue}
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
