'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
} from '@/components/ui';

const EMPTY_FORM = {
  serial: '',
  arabicName: '',
  englishName: '',
};

export default function DelegateGroupPage() {
  useBackendReachability();
  const [formData, setFormData] = useState(EMPTY_FORM);

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
  };

  const advancedFilledCount = [formData.englishName].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      <PageHeader
        title="بطاقة مجموعة مندوبين"
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'البطاقات' },
          { label: 'مجموعة مندوبين' },
        ]}
      />

      <form className="w-full text-base">
        <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف مجموعة المندوبين" icon={Users}>
          <CompactFormField
            label="المسلسل"
            value={formData.serial}
            onChange={(e) => setFormData((prev) => ({ ...prev, serial: e.target.value }))}
            placeholder="إدخل رقم المسلسل"
          />
          <CompactFormField
            label="الإسم العربي"
            value={formData.arabicName}
            onChange={(e) => setFormData((prev) => ({ ...prev, arabicName: e.target.value }))}
            placeholder="إدخل الإسم بالعربي"
          />
        </FormSectionCard>

        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="الإسم الإنجليزي"
              value={formData.englishName}
              onChange={(e) => setFormData((prev) => ({ ...prev, englishName: e.target.value }))}
              placeholder="إدخل الإسم بالإنجليزي"
            />
          </div>
        </AdvancedFieldsSection>

        <FormStickyFooter onCancel={handleCancel} onSave={() => {}} status="مسودة" />
      </form>
    </div>
  );
}
