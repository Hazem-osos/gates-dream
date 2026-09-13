'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import type { OwnerBoqItem } from '@/lib/contracting/types';
import { formatEgp, percentInputToRate, rateToPercentInput, toMoney } from '@/lib/subcontracts/money';

type Rates = {
  generalOverheadRate: string;
  siteOverheadRate: string;
  contingencyRiskRate: string;
  profitMarginRate: string;
  contractTaxesRate: string;
  applyAtProjectLevel: boolean;
};

const FIELDS: Array<{ key: keyof Omit<Rates, 'applyAtProjectLevel'>; label: string }> = [
  { key: 'generalOverheadRate', label: 'مصاريف عمومية وإدارية %' },
  { key: 'siteOverheadRate', label: 'مصاريف موقع غير مباشرة %' },
  { key: 'contingencyRiskRate', label: 'احتياطي / مخاطر %' },
  { key: 'profitMarginRate', label: 'هامش الربح %' },
  { key: 'contractTaxesRate', label: 'ضرائب تعاقدية %' },
];

export function BoqMarkupModal({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: OwnerBoqItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = item?.markupStructures?.[0];
  const [rates, setRates] = useState<Rates>({
    generalOverheadRate: rateToPercentInput(existing?.generalOverheadRate ?? 0.08),
    siteOverheadRate: rateToPercentInput(existing?.siteOverheadRate ?? 0.05),
    contingencyRiskRate: rateToPercentInput(existing?.contingencyRiskRate ?? 0.03),
    profitMarginRate: rateToPercentInput(existing?.profitMarginRate ?? 0.12),
    contractTaxesRate: rateToPercentInput(existing?.contractTaxesRate ?? 0),
    applyAtProjectLevel: false,
  });

  const calc = useMemo(() => {
    const direct = toMoney(item?.directCostEstimated);
    const oh =
      1 +
      percentInputToRate(rates.generalOverheadRate) +
      percentInputToRate(rates.siteOverheadRate) +
      percentInputToRate(rates.contingencyRiskRate);
    const withOh = direct * oh;
    const selling = withOh * (1 + percentInputToRate(rates.profitMarginRate)) * (1 + percentInputToRate(rates.contractTaxesRate));
    return {
      direct,
      withOh,
      selling,
      total: selling * toMoney(item?.contractQuantity),
    };
  }, [item, rates]);

  const save = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error('missing item');
      return apiClient.post(`/contracting/technical-office/boq/${item.id}/markup`, {
        generalOverheadRate: percentInputToRate(rates.generalOverheadRate),
        siteOverheadRate: percentInputToRate(rates.siteOverheadRate),
        contingencyRiskRate: percentInputToRate(rates.contingencyRiskRate),
        profitMarginRate: percentInputToRate(rates.profitMarginRate),
        contractTaxesRate: percentInputToRate(rates.contractTaxesRate),
        applyAtProjectLevel: rates.applyAtProjectLevel,
      });
    },
    onSuccess: () => {
      notifyApiSuccess('تم احتساب سعر البيع');
      onSaved();
      onClose();
    },
  });

  if (!open || !item) return null;

  const advancedFilledCount = [rates.applyAtProjectLevel ? '1' : ''].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-xl">
        <div className="p-5 pb-0">
          <h2 className="mb-4 text-lg font-bold text-[#0E79AA]">تحميل التكاليف والربح — {item.itemCode}</h2>
          <FormSectionCard title="نسب التحميل" subtitle="الأعباء غير المباشرة وهامش الربح والضرائب" icon={Calculator}>
            {FIELDS.map((field) => (
              <CompactFormField
                key={field.key}
                label={field.label}
                hint={`${rates[field.key]}٪`}
                className="sm:col-span-2 lg:col-span-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="0.1"
                    className="w-full accent-[#0E79AA]"
                    value={rates[field.key]}
                    onChange={(e) => setRates((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={rates[field.key]}
                    onChange={(e) => setRates((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              </CompactFormField>
            ))}
          </FormSectionCard>

          <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CompactFormField label="نطاق التطبيق" className="sm:col-span-2 lg:col-span-3">
                <label className="flex items-center gap-2 text-sm text-[#094C6B]">
                  <input
                    type="checkbox"
                    checked={rates.applyAtProjectLevel}
                    onChange={(e) => setRates((prev) => ({ ...prev, applyAtProjectLevel: e.target.checked }))}
                  />
                  تطبيق الهيكل على كل بنود المشروع
                </label>
              </CompactFormField>
            </div>
          </AdvancedFieldsSection>

          <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-[#F6FBFD] p-4 text-sm">
            <div>
              <p className="text-slate-500">التكلفة المباشرة</p>
              <p className="font-bold tabular-nums text-[#094C6B]">{formatEgp(calc.direct)}</p>
            </div>
            <div>
              <p className="text-slate-500">بعد الأعباء غير المباشرة</p>
              <p className="font-bold tabular-nums text-[#094C6B]">{formatEgp(calc.withOh)}</p>
            </div>
            <div>
              <p className="text-slate-500">سعر بيع الوحدة النهائي</p>
              <p className="font-bold tabular-nums text-[#0E79AA]">{formatEgp(calc.selling)}</p>
            </div>
            <div>
              <p className="text-slate-500">إجمالي قيمة البند</p>
              <p className="font-bold tabular-nums text-[#0E79AA]">{formatEgp(calc.total)}</p>
            </div>
          </div>
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={() => save.mutate()}
          saveText="حفظ واحتساب السعر"
          cancelText="إلغاء"
          saveLoading={save.isPending}
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
