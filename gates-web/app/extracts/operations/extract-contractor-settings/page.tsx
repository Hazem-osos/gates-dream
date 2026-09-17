'use client';

import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { Settings2 } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import SuccessToast from '@/components/SuccessToast';

const ACCOUNTS = [
  'حساب المقاولين الرئيسي',
  'حساب تكاليف المشاريع الرئيسي',
  'حساب المصروفات الإدارية الرئيسي',
  'حساب المصروفات المالية الرئيسي',
  'حساب الإيرادات الرئيسي',
  'حساب الضرائب الرئيسي',
  'حساب التأمينات الرئيسي',
  'حساب الخصومات الرئيسي',
];

const SETTINGS = [
  'إظهار صلاحيات الشاشة',
  'تطبيق ضريبة خصم المنبع',
  'تطبيق مؤيد أو غير مؤيد',
  'إستخدام التاريخ الميلادي',
  'إظهار كلا التاريخين',
  'التأثير المباشر على السندات و الأوراق',
];

export default function ExtractContractorSettingsPage() {
  useBackendReachability();
  const [success, setSuccess] = useState('');

  return (
    <ExtractsPageChrome
      title="إعدادات المستخلصات و المقاولات"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'إعدادات المستخلصات و المقاولات' },
      ]}
      onSave={() => setSuccess('تم حفظ إعدادات الشاشة')}
      onNew={() => setSuccess('')}
      statusLabel="إعدادات"
      favoriteHref="/extracts/operations/extract-contractor-settings"
    >
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      <FormSectionCard title="الحسابات" subtitle="ربط حسابات الدليل بإعدادات المستخلصات" icon={Settings2}>
        {ACCOUNTS.map((account) => (
          <CompactFormField key={account} label={account} placeholder="اختر الحساب" />
        ))}
      </FormSectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FormSectionCard title="إعدادات عامة" className="mb-0">
          {SETTINGS.map((setting) => (
            <label
              key={setting}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E78AA]/30"
              />
              {setting}
            </label>
          ))}
        </FormSectionCard>
        <FormSectionCard title="مستخلصات مقاولي الباطن" className="mb-0">
          {SETTINGS.map((setting) => (
            <label
              key={`sub-${setting}`}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E78AA]/30"
              />
              {setting}
            </label>
          ))}
        </FormSectionCard>
      </div>
    </ExtractsPageChrome>
  );
}
