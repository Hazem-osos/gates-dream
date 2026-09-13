'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarRange, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { formatEgp, percentToRate, toMoney } from '@/lib/real-estate/format';
import { installmentCountFromYears, previewSchedule, type BalloonDraft } from '@/lib/real-estate/schedule-preview';
import type { InstallmentFrequency, UnitContract } from '@/lib/real-estate/types';
import { INSTALLMENT_TYPE_LABEL } from './StatusBadges';

const FREQ: Array<{ value: InstallmentFrequency; label: string }> = [
  { value: 'MONTHLY', label: 'شهري' },
  { value: 'QUARTERLY', label: 'ربع سنوي' },
  { value: 'SEMI_ANNUAL', label: 'نصف سنوي' },
];

export function GenerateScheduleModal({
  open,
  contract,
  onClose,
  onSaved,
}: {
  open: boolean;
  contract: UnitContract;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const selling = toMoney(contract.totalSellingPrice || contract.totalContractAmount);
  const maintenance = toMoney(contract.maintenanceDeposit || contract.maintenanceAmount);
  const [reservationPercent, setReservationPercent] = useState('10');
  const [contractingPercent, setContractingPercent] = useState('10');
  const [deliveryPercent, setDeliveryPercent] = useState('10');
  const [frequency, setFrequency] = useState<InstallmentFrequency>('MONTHLY');
  const [durationYears, setDurationYears] = useState('4');
  const [deliveryDueDate, setDeliveryDueDate] = useState('');
  const [maintenanceDueDate, setMaintenanceDueDate] = useState('');
  const [balloons, setBalloons] = useState<BalloonDraft[]>([]);

  const preview = useMemo(
    () =>
      previewSchedule({
        sellingPrice: selling,
        maintenanceDeposit: maintenance,
        reservationPercent: toMoney(reservationPercent),
        contractingPercent: toMoney(contractingPercent),
        deliveryPercent: toMoney(deliveryPercent),
        frequency,
        durationYears: toMoney(durationYears),
        deliveryDueDate,
        maintenanceDueDate,
        balloons,
      }),
    [selling, maintenance, reservationPercent, contractingPercent, deliveryPercent, frequency, durationYears, deliveryDueDate, maintenanceDueDate, balloons]
  );

  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/real-estate/contracts/${contract.id}/schedule`, {
        reservationRate: percentToRate(reservationPercent),
        contractingDownpaymentRate: percentToRate(contractingPercent),
        deliveryRate: percentToRate(deliveryPercent),
        frequency,
        installmentCount: installmentCountFromYears(frequency, toMoney(durationYears)),
        deliveryDueDate: deliveryDueDate || undefined,
        maintenanceDueDate: maintenanceDueDate || undefined,
        annualBalloons: balloons
          .filter((row) => row.dueDate && (row.amount || row.ratePercent))
          .map((row) => ({
            dueDate: row.dueDate,
            amount: row.amount ? Number(row.amount) : undefined,
            rateOfSellingPrice: row.ratePercent ? percentToRate(row.ratePercent) : undefined,
          })),
        replaceExisting: true,
      }),
    onSuccess: () => {
      notifyApiSuccess('تم توليد جدول الأقساط');
      onSaved?.();
      onClose();
    },
  });

  if (!open) return null;

  const advancedFilledCount =
    [deliveryDueDate, maintenanceDueDate].filter((v) => v.trim().length > 0).length + balloons.length;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-[#0E79AA0D] p-5 pb-4">
          <h2 className="mb-1 text-lg font-bold text-[#0E79AA]">توليد جدول السداد</h2>
          <p className="text-sm text-slate-500">
            سعر البيع {formatEgp(selling)} + وديعة الصيانة {formatEgp(maintenance)} = المستهدف {formatEgp(selling + maintenance)}
          </p>
        </div>
        <div className="p-5 pb-0">
          <FormSectionCard title="البيانات الأساسية" subtitle="نسب الدفعات والدورية ومدة التقسيط" icon={CalendarRange}>
            <CompactFormField
              label="عربون الحجز ٪"
              type="number"
              min="0"
              value={reservationPercent}
              onChange={(e) => setReservationPercent(e.target.value)}
            />
            <CompactFormField
              label="دفعة التعاقد ٪"
              type="number"
              min="0"
              value={contractingPercent}
              onChange={(e) => setContractingPercent(e.target.value)}
            />
            <CompactFormField
              label="دفعة التسليم ٪"
              type="number"
              min="0"
              value={deliveryPercent}
              onChange={(e) => setDeliveryPercent(e.target.value)}
            />
            <CompactFormField label="الدورية">
              <select
                className={compactControlClass}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as InstallmentFrequency)}
              >
                {FREQ.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField
              label="المدة (سنوات)"
              type="number"
              min="0"
              step="0.5"
              value={durationYears}
              onChange={(e) => setDurationYears(e.target.value)}
            />
          </FormSectionCard>

          <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CompactFormField
                label="تاريخ دفعة التسليم"
                type="date"
                value={deliveryDueDate}
                onChange={(e) => setDeliveryDueDate(e.target.value)}
              />
              <CompactFormField
                label="استحقاق وديعة الصيانة"
                type="date"
                className="sm:col-span-2"
                value={maintenanceDueDate}
                onChange={(e) => setMaintenanceDueDate(e.target.value)}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">أقساط سنوية اختيارية</h3>
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart={<Plus className="h-4 w-4" />}
                  onClick={() => setBalloons((prev) => [...prev, { dueDate: '', amount: '', ratePercent: '' }])}
                >
                  إضافة بالون
                </Button>
              </div>
              {balloons.map((row, index) => (
                <div key={index} className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <CompactFormField
                    label="التاريخ"
                    type="date"
                    value={row.dueDate}
                    onChange={(e) => setBalloons((prev) => prev.map((item, i) => (i === index ? { ...item, dueDate: e.target.value } : item)))}
                  />
                  <CompactFormField
                    label="المبلغ"
                    placeholder="المبلغ"
                    value={row.amount}
                    onChange={(e) => setBalloons((prev) => prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)))}
                  />
                  <CompactFormField
                    label="أو النسبة ٪"
                    placeholder="أو النسبة ٪"
                    value={row.ratePercent}
                    onChange={(e) => setBalloons((prev) => prev.map((item, i) => (i === index ? { ...item, ratePercent: e.target.value } : item)))}
                  />
                  <button type="button" className="mt-6" onClick={() => setBalloons((prev) => prev.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          </AdvancedFieldsSection>

          <div className="mb-4 rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] p-3 text-sm">
            <p className={preview.balanced ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>
              مجموع الجدول {formatEgp(preview.total)} مقابل المستهدف {formatEgp(preview.target)}
              {preview.balanced ? ' — مطابق' : ' — غير مطابق'}
            </p>
            {preview.error ? <p className="mt-1 text-red-600">{preview.error}</p> : null}
            <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-slate-600">
              {preview.lines.map((line, i) => (
                <li key={`${line.installmentType}-${i}`}>
                  {INSTALLMENT_TYPE_LABEL[line.installmentType]} — {formatEgp(line.amount)}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={() => mutation.mutate()}
          saveText="توليد الجدول"
          cancelText="إلغاء"
          saveLoading={mutation.isPending}
          saveDisabled={!preview.balanced}
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
