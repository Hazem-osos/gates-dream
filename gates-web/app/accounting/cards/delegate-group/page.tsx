'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useMemo, useState } from 'react';
import { confirmAction } from '@/lib/feedback/confirm';
import { Users } from 'lucide-react';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  AppTable,
} from '@/components/ui';
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

const EMPTY_FORM = {
  serial: '',
  arabicName: '',
  englishName: '',
};

type StoredGroup = typeof EMPTY_FORM;

function readStoredGroups(): StoredGroup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('gates:delegate-groups');
    return raw ? (JSON.parse(raw) as StoredGroup[]) : [];
  } catch {
    return [];
  }
}

export default function DelegateGroupPage() {
  useBackendReachability();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const rows = useMemo(() => readStoredGroups(), [success, saving]);

  const handleNew = () => {
    setFormData({ ...EMPTY_FORM });
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
      const existing = readStoredGroups();
      const serial =
        formData.serial.trim() ||
        String(existing.length + 1).padStart(3, '0');
      const next = [
        ...existing.filter((row) => row.serial !== serial),
        { ...formData, serial },
      ];
      window.localStorage.setItem(key, JSON.stringify(next));
      setFormData({ ...EMPTY_FORM });
      setSuccess('تم حفظ مجموعة المندوبين — تقدر تضيف التالي');
    } catch {
      setError('تعذر حفظ مجموعة المندوبين');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!formData.serial) return;
    if (!(await confirmAction(`حذف المجموعة «${formData.arabicName || formData.serial}»؟`))) return;
    const next = readStoredGroups().filter((row) => row.serial !== formData.serial);
    window.localStorage.setItem('gates:delegate-groups', JSON.stringify(next));
    handleNew();
    setSuccess('تم حذف المجموعة');
  };

  const advancedFilledCount = [formData.englishName].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <MasterCardShell
      title="بطاقة مجموعة مندوبين"
      breadcrumbs={[
        { label: 'الحسابات', href: '/accounting' },
        { label: 'البطاقات' },
        { label: 'مجموعة مندوبين' },
      ]}
      docNumber={formData.serial || 'جديد'}
      statusLabel={formData.arabicName ? 'تعديل' : 'جديد'}
      onSave={handleSave}
      savePending={saving}
      canSave={!saving}
      onNew={handleNew}
      onDelete={handleDelete}
      currentId={formData.serial || null}
      onBrowseList={() => setShowGuide(true)}
      favoriteHref="/accounting/cards/delegate-group"
    >
      <form className="w-full text-base">
        <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف مجموعة المندوبين" icon={Users}>
          <CompactFormField
            label="الكود"
            value={formData.serial}
            disabled
            readOnly
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
      </form>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <DocumentBrowseDrawer
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="مجموعات المندوبين السابقة"
      >
        <AppTable<StoredGroup>
          data={rows}
          getRowKey={(r) => r.serial || r.arabicName}
          emptyTitle="لا توجد مجموعات محفوظة"
          onRowClick={(row) => {
            setFormData(row);
            setShowGuide(false);
          }}
          columns={[
            { id: 'serial', header: 'الكود', accessor: 'serial' },
            { id: 'name', header: 'الاسم', accessor: 'arabicName' },
          ]}
        />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}
