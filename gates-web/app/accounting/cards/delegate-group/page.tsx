'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import React, { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
} from '@/components/ui';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { nextNumericSerial } from '@/lib/masters/nextNumericSerial';

const EMPTY_FORM = {
  serial: '',
  arabicName: '',
  englishName: '',
};

export default function DelegateGroupPage() {
  useBackendReachability();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const storedSerials = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('gates:delegate-groups');
      const rows = raw ? (JSON.parse(raw) as Array<{ serial?: string }>) : [];
      return rows.map((row) => row.serial);
    } catch {
      return [];
    }
  }, [success]);
  const nextSerial = nextNumericSerial(storedSerials);

  useEffect(() => {
    setFormData((prev) => (prev.serial ? prev : { ...prev, serial: nextSerial }));
  }, [nextSerial]);

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
    setError('');
    setSuccess('');
  };

  const handleSave = () => {
    if (!formData.arabicName.trim()) {
      setSuccess('');
      setError('أدخل الاسم العربي لمجموعة المندوبين قبل الحفظ');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const key = 'gates:delegate-groups';
      const raw = window.localStorage.getItem(key);
      const existing = raw ? (JSON.parse(raw) as Array<typeof EMPTY_FORM>) : [];
      const next = [
        ...existing.filter((row) => row.serial !== formData.serial || !formData.serial),
        { ...formData },
      ];
      window.localStorage.setItem(key, JSON.stringify(next));
      setSuccess('تم حفظ مجموعة المندوبين');
    } catch {
      setError('تعذر حفظ مجموعة المندوبين');
    } finally {
      setSaving(false);
    }
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
            disabled
            placeholder="تلقائي"
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

        <FormStickyFooter
          onCancel={handleCancel}
          onSave={handleSave}
          saveLoading={saving}
          status={success ? 'محفوظ' : 'مسودة'}
        />
      </form>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
