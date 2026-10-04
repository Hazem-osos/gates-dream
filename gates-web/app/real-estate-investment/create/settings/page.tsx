'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { FormSectionCard, CompactFormField, compactControlClass } from '@/components/ui';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type SettingsRow = {
  id: string;
  realEstateArAccountCode?: string | null;
  unearnedRealEstateRevenueAccountCode?: string | null;
  realEstateRevenueAccountCode?: string | null;
  maintenanceDepositsAccountCode?: string | null;
  penaltyRevenueAccountCode?: string | null;
};

const emptyForm = () => ({
  realEstateArAccountCode: '',
  unearnedRealEstateRevenueAccountCode: '',
  realEstateRevenueAccountCode: '',
  maintenanceDepositsAccountCode: '',
  penaltyRevenueAccountCode: '',
});

const crumbs = [
  { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
  { label: 'الإعدادات' },
];

export default function RealEstateSettings() {
  const invalidate = useInvalidateQuery();
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);

  const { data, isLoading } = useApiQuery<SettingsRow>(
    ['real-estate-settings'],
    '/real-estate/settings'
  );

  useEffect(() => {
    const row = data?.data;
    if (!row) return;
    setForm({
      realEstateArAccountCode: row.realEstateArAccountCode ?? '',
      unearnedRealEstateRevenueAccountCode: row.unearnedRealEstateRevenueAccountCode ?? '',
      realEstateRevenueAccountCode: row.realEstateRevenueAccountCode ?? '',
      maintenanceDepositsAccountCode: row.maintenanceDepositsAccountCode ?? '',
      penaltyRevenueAccountCode: row.penaltyRevenueAccountCode ?? '',
    });
  }, [data?.data]);

  const patch = (field: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setPending(true);
    try {
      await apiClient.put('/real-estate/settings', {
        realEstateArAccountCode: form.realEstateArAccountCode.trim() || null,
        unearnedRealEstateRevenueAccountCode:
          form.unearnedRealEstateRevenueAccountCode.trim() || null,
        realEstateRevenueAccountCode: form.realEstateRevenueAccountCode.trim() || null,
        maintenanceDepositsAccountCode: form.maintenanceDepositsAccountCode.trim() || null,
        penaltyRevenueAccountCode: form.penaltyRevenueAccountCode.trim() || null,
      });
      toast.success('تم حفظ إعدادات الاستثمار العقاري');
      invalidate(['real-estate-settings']);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر حفظ الإعدادات');
    } finally {
      setPending(false);
    }
  };

  return (
    <MasterCardShell
      title="إعدادات الاستثمار العقاري"
      breadcrumbs={crumbs}
      favoriteHref="/real-estate-investment/create/settings"
      statusLabel="إعدادات"
      currentId={data?.data?.id ?? null}
      onSave={() => void handleSave()}
      savePending={pending || isLoading}
    >
      <FormSectionCard
        title="حسابات الترحيل"
        subtitle="أكواد حسابات دفتر الأستاذ المستخدمة في ترحيل العقود والتسليم"
        icon={Settings}
      >
        <CompactFormField label="حساب ذمم العقارات">
          <input
            className={compactControlClass}
            value={form.realEstateArAccountCode}
            onChange={(e) => patch('realEstateArAccountCode', e.target.value)}
            placeholder="مثال: 1210"
          />
        </CompactFormField>
        <CompactFormField label="حساب الإيراد المؤجل">
          <input
            className={compactControlClass}
            value={form.unearnedRealEstateRevenueAccountCode}
            onChange={(e) => patch('unearnedRealEstateRevenueAccountCode', e.target.value)}
            placeholder="مثال: 2460"
          />
        </CompactFormField>
        <CompactFormField label="حساب إيراد العقارات">
          <input
            className={compactControlClass}
            value={form.realEstateRevenueAccountCode}
            onChange={(e) => patch('realEstateRevenueAccountCode', e.target.value)}
            placeholder="مثال: 4100"
          />
        </CompactFormField>
        <CompactFormField label="حساب ودائع الصيانة">
          <input
            className={compactControlClass}
            value={form.maintenanceDepositsAccountCode}
            onChange={(e) => patch('maintenanceDepositsAccountCode', e.target.value)}
            placeholder="مثال: 2470"
          />
        </CompactFormField>
        <CompactFormField label="حساب إيراد الغرامات">
          <input
            className={compactControlClass}
            value={form.penaltyRevenueAccountCode}
            onChange={(e) => patch('penaltyRevenueAccountCode', e.target.value)}
            placeholder="مثال: 4110"
          />
        </CompactFormField>
      </FormSectionCard>
    </MasterCardShell>
  );
}
