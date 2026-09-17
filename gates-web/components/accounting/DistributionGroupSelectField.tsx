'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CompactFormField, compactControlClass } from '@/components/ui';
import {
  DistributionGroupModal,
  type DistributionFolderRole,
  type DistributionGroupSaved,
} from '@/components/accounting/DistributionGroupModal';
import { toast } from '@/lib/feedback/toast';

type Option = {
  id: string;
  code?: string | null;
  serial?: string | null;
  arabicName: string;
};

type Props = {
  folderRole: DistributionFolderRole;
  label?: string;
  value: string;
  options: Option[];
  onChange: (id: string) => void;
  onCreated: (row: Option) => void;
};

export function DistributionGroupSelectField({
  folderRole,
  label = 'المجموعة',
  value,
  options,
  onChange,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <CompactFormField label={label}>
        <div className="flex items-center gap-1.5">
          <select
            className={`${compactControlClass} min-w-0 flex-1`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">بدون مجموعة</option>
            {options.map((group) => (
              <option key={group.id} value={group.id}>
                {group.code || group.serial
                  ? `${group.code || group.serial} — ${group.arabicName}`
                  : group.arabicName}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="إضافة مجموعة"
            title="إضافة مجموعة"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D6EAF3] bg-white text-[#0E79AA] hover:border-[#0E79AA] hover:bg-[#F0F7FB]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
      </CompactFormField>
      {open ? (
        <DistributionGroupModal
          open
          folderRole={folderRole}
          onClose={() => setOpen(false)}
          onSaved={(row: DistributionGroupSaved) => {
            onCreated({
              id: row.id,
              code: row.code || row.serial,
              arabicName: row.arabicName,
            });
            onChange(row.id);
            toast.success('تم حفظ المجموعة');
          }}
          onError={(msg) => toast.error(msg)}
        />
      ) : null}
    </>
  );
}
