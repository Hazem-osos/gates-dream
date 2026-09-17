'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { Megaphone } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { FormSectionCard, CompactFormField } from '@/components/ui';
import { toast } from '@/lib/feedback/toast';

const crumbs = [
  { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
  { label: 'قنوات التسويق' },
];

export default function MarketingChannelsPage() {
  useBackendReachability();

  return (
    <MasterCardShell
      title="تعريف قنوات التسويق"
      breadcrumbs={crumbs}
      favoriteHref="/real-estate-investment/create/marketing-channels"
      onSave={() => toast.success('تم الحفظ')}
    >
      <FormSectionCard title="البيانات الأساسية" subtitle="كود القناة والاسم ومدة الإعلان" icon={Megaphone}>
        <CompactFormField label="الكود" placeholder="إدخل رقم الكود" />
        <CompactFormField label="الإسم العربي" placeholder="إدخل الإسم بالعربي" />
        <CompactFormField label="الإسم الإنجليزي" placeholder="إدخل الإسم الإنجليزي" />
        <CompactFormField label="المدة" placeholder="إدخل المدة" />
        <CompactFormField label="منطقة الإعلان" placeholder="إدخل منطقة الإعلان" className="sm:col-span-2" />
      </FormSectionCard>
    </MasterCardShell>
  );
}
