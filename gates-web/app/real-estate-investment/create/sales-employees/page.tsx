'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { Users } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { FormSectionCard, CompactFormField, compactControlClass } from '@/components/ui';
import { toast } from '@/lib/feedback/toast';

const crumbs = [
  { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
  { label: 'موظفو المبيعات' },
];

export default function SalesEmployees() {
  useBackendReachability();

  return (
    <MasterCardShell
      title="تعريف موظفي المبيعات"
      breadcrumbs={crumbs}
      favoriteHref="/real-estate-investment/create/sales-employees"
      onSave={() => toast.success('تم الحفظ')}
    >
      <FormSectionCard title="البيانات الأساسية" subtitle="كود الموظف والاسم وبيانات الاتصال" icon={Users}>
        <CompactFormField label="الكود" placeholder="إدخل رقم الكود" />
        <CompactFormField label="الإسم العربي" placeholder="إدخل الإسم بالعربي" />
        <CompactFormField label="الإسم الإنجليزي" placeholder="إدخل الإسم الإنجليزي" />
        <CompactFormField label="تليفون 1" placeholder="إدخل رقم التليفون" />
        <CompactFormField label="تليفون 2" placeholder="إدخل رقم التليفون" />
        <CompactFormField label="النوع">
          <select className={compactControlClass} defaultValue="">
            <option value="">اختر النوع</option>
            <option value="داخلي">داخلي</option>
            <option value="خارجي">خارجي</option>
          </select>
        </CompactFormField>
        <CompactFormField label="الجنس">
          <select className={compactControlClass} defaultValue="">
            <option value="">اختر الجنس</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
        </CompactFormField>
        <CompactFormField label="المستخدم" defaultValue="1010101" />
        <label className="flex items-center gap-2 pb-2 text-sm text-[#094C6B] sm:col-span-2">
          <input type="checkbox" className="accent-[#0E78AA]" />
          الإطلاع على جميع العملاء
        </label>
      </FormSectionCard>
    </MasterCardShell>
  );
}
