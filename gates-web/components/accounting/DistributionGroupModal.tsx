'use client';

import { useEffect, useState } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { CompactFormField, FormStickyFooter } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useNextMasterSerial } from '@/lib/hooks/useNextMasterSerial';

export type DistributionFolderRole = 'DRIVER' | 'DISTRIBUTOR' | 'DELEGATE';

export type DistributionGroupSaved = {
  id: string;
  code?: string | null;
  serial?: string | null;
  arabicName: string;
};

type Props = {
  open: boolean;
  parentId?: string | null;
  parentLabel?: string | null;
  folderRole: DistributionFolderRole;
  initial?: { id: string; code: string; arabicName: string; folderRole?: DistributionFolderRole } | null;
  onClose: () => void;
  onSaved: (row: DistributionGroupSaved) => void;
  onError: (msg: string) => void;
};

export function groupRoleForFolder(folder: DistributionFolderRole) {
  if (folder === 'DRIVER') return 'GROUP_DRIVER' as const;
  if (folder === 'DISTRIBUTOR') return 'GROUP_DISTRIBUTOR' as const;
  return 'GROUP_DELEGATE' as const;
}

export function DistributionGroupModal({
  open,
  parentId,
  parentLabel,
  folderRole,
  initial,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [code, setCode] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);
  const { data: nextSerialResponse } = useNextMasterSerial(
    ['delegates', 'next-code', 'group'],
    '/accounting/delegates/next-code',
    open && !isEdit
  );
  const nextSerial = nextSerialResponse?.data?.serial || '';

  useEffect(() => {
    if (!open) return;
    setCode(initial?.code || '');
    setArabicName(initial?.arabicName || '');
  }, [open, initial]);

  useEffect(() => {
    if (!open || isEdit || !nextSerial) return;
    setCode(nextSerial);
  }, [isEdit, nextSerial, open]);

  const submit = async () => {
    if (!arabicName.trim()) {
      onError('الاسم العربي مطلوب للمجموعة');
      return;
    }
    setSaving(true);
    try {
      const autoCode = code.trim() || nextSerial || undefined;
      const payload = {
        role: groupRoleForFolder(initial?.folderRole || folderRole),
        arabicName: arabicName.trim(),
        serial: autoCode,
        code: autoCode,
        ...(initial?.id ? {} : { groupId: parentId || null }),
      };
      const res = initial?.id
        ? await apiClient.put<DistributionGroupSaved>(`/accounting/delegates/${initial.id}`, payload)
        : await apiClient.post<DistributionGroupSaved>('/accounting/delegates', payload);
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
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="distribution-group-title">
      <div className="flex min-h-0 flex-col" dir="rtl">
        <div className="p-6 pb-2">
          <h2 id="distribution-group-title" className="text-lg font-bold text-[#0E79AA]">
            {initial ? 'تعديل مجموعة' : 'إضافة مجموعة'}
          </h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            {parentLabel ? `تحت «${parentLabel}» — ` : ''}
            المجموعة فرع جوه سائق أو موزع أو مندوب، مش أصل جديد جنبهم.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField
              label="الكود"
              value={code}
              disabled
              readOnly
              placeholder="تلقائي"
            />
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
