'use client';

import { useEffect, useState } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { CompactFormField, FormStickyFooter } from '@/components/ui';
import { apiClient } from '@/lib/api/client';

type Props = {
  open: boolean;
  parentId?: string | null;
  parentLabel?: string | null;
  suggestedCode?: string;
  initial?: { id: string; code: string; arabicName: string } | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
};

export function DistributionGroupModal({
  open,
  parentId,
  parentLabel,
  suggestedCode,
  initial,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [code, setCode] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(initial?.code || suggestedCode || '');
    setArabicName(initial?.arabicName || '');
  }, [open, initial, suggestedCode]);

  const submit = async () => {
    if (!arabicName.trim()) {
      onError('الاسم العربي مطلوب للمجموعة');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        role: 'GROUP' as const,
        arabicName: arabicName.trim(),
        serial: code.trim() || undefined,
        code: code.trim() || undefined,
        groupId: parentId || null,
      };
      if (initial?.id) {
        await apiClient.put(`/accounting/delegates/${initial.id}`, payload);
      } else {
        await apiClient.post('/accounting/delegates', payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'تعذّر حفظ المجموعة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="distribution-group-title">
      <div className="flex min-h-0 flex-col" dir="rtl">
        <div className="p-6 pb-2">
          <h2 id="distribution-group-title" className="text-lg font-bold text-[#0E79AA]">
            {initial ? 'تعديل مجموعة' : 'إضافة مجموعة'}
          </h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            {parentLabel ? `تحت «${parentLabel}» — ` : ''}
            كود واسم فقط، زي الحساب الرئيسي. الأفراد بيتضافوا بعدين من + فرعي.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField label="الكود" value={code} onChange={(e) => setCode(e.target.value)} />
            <CompactFormField
              label="الاسم العربي"
              required
              value={arabicName}
              onChange={(e) => setArabicName(e.target.value)}
            />
          </div>
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={() => void submit()}
          saveLoading={saving}
          cancelText="إلغاء"
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </CenteredOverlay>
  );
}
