'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { Settings } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { FormSectionCard, CompactFormField } from '@/components/ui';
import { toast } from '@/lib/feedback/toast';

const crumbs = [
  { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
  { label: 'الإعدادات' },
];

export default function RealEstateSettings() {
  useBackendReachability();

  return (
    <MasterCardShell
      title="إعدادات الاستثمار العقاري"
      breadcrumbs={crumbs}
      favoriteHref="/real-estate-investment/create/settings"
      statusLabel="إعدادات"
      onSave={() => toast.success('تم حفظ الإعدادات')}
    >
      <FormSectionCard title="البيانات الأساسية" subtitle="حدود المتابعة والمعاينة وانحراف المساحة" icon={Settings}>
        <CompactFormField label="المجموعة" defaultValue="1010101" />
        <CompactFormField label="تحذير المتابعة" type="number" placeholder="عدد الأيام" />
        <CompactFormField label="تحذير المعاينة" type="number" placeholder="عدد الأيام" />
        <CompactFormField label="أخرى 1" type="number" placeholder="إدخل العدد" />
        <CompactFormField label="أخرى 2" type="number" placeholder="إدخل العدد" />
        <CompactFormField label="أخرى 3" type="number" placeholder="إدخل العدد" />
        <CompactFormField label="إنحراف المساحة +" type="number" placeholder="إدخل العدد" />
        <CompactFormField label="إنحراف المساحة -" type="number" placeholder="إدخل العدد" />
      </FormSectionCard>
    </MasterCardShell>
  );
}
