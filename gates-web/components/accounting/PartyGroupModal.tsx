'use client';

import { useEffect, useState } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { CompactFormField, FormStickyFooter } from '@/components/ui';
import { apiClient } from '@/lib/api/client';

export type PartyGroupKind = 'customer' | 'supplier';

export type PartyGroupSaved = {
  id: string;
  code?: string | null;
  legacyCode?: string | null;
  arabicName: string;
};

const COPY: Record<PartyGroupKind, { title: string; api: string }> = {
  customer: { title: 'مجموعة عملاء', api: '/accounting/customer-categories' },
  supplier: { title: 'مجموعة موردين', api: '/accounting/supplier-categories' },
};

type Props = {
  open: boolean;
  kind: PartyGroupKind;
  initial?: { id: string; code: string; arabicName: string } | null;
  onClose: () => void;
  onSaved: (row: PartyGroupSaved) => void;
  onError: (msg: string) => void;
};

export function PartyGroupModal({ open, kind, initial, onClose, onSaved, onError }: Props) {
  const copy = COPY[kind];
  const [code, setCode] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(initial?.code || '');
    setArabicName(initial?.arabicName || '');
  }, [open, initial]);

  const submit = async () => {
    if (!code.trim()) {
      onError('الكود مطلوب للمجموعة');
      return;
    }
    if (!arabicName.trim()) {
      onError('الاسم العربي مطلوب للمجموعة');
      return;
    }
    setSaving(true);
    try {
      const payload = { code: code.trim(), arabicName: arabicName.trim() };
      const res = initial?.id
        ? await apiClient.put<PartyGroupSaved>(`${copy.api}/${initial.id}`, payload)
        : await apiClient.post<PartyGroupSaved>(copy.api, payload);
      if (!res.data?.id) throw new Error('تعذّر حفظ المجموعة');
      onSaved(res.data);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'تعذّر حفظ المجموعة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="party-group-title">
      <div className="flex min-h-0 flex-col" dir="rtl">
        <div className="p-6 pb-2">
          <h2 id="party-group-title" className="text-lg font-bold text-[#0E79AA]">
            {initial ? `تعديل ${copy.title}` : `إضافة ${copy.title}`}
          </h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            كود واسم فقط. المجموعة تظهر في شجرة العملاء أو الموردين، وتقدر تضيف تحتها أفراد.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField
              label="الكود"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="إدخل الكود"
            />
            <CompactFormField
              label="الاسم العربي"
              required
              value={arabicName}
              onChange={(e) => setArabicName(e.target.value)}
              placeholder="إدخل اسم المجموعة"
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
