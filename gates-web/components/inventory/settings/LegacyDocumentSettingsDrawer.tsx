'use client';

import { useEffect, useState } from 'react';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { Button } from '@/components/ui/button';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';
import {
  LEGACY_DOCUMENT_PROFILE_TITLES,
  type LegacyDocumentProfileId,
  type LegacyDocumentSettings,
} from '@/lib/inventory/legacy-document-settings-profiles';
import {
  invalidateAfterLegacyDocumentSettingsSave,
} from '@/lib/inventory/transaction-settings-invalidate';

type SwitchRowProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
};

function SwitchRow({ checked, onChange, label, hint }: SwitchRowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E6F0F7] bg-white px-3 py-3 hover:border-[#0E78AA]/40">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[#0E78AA]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#0A3D5E]">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

export function LegacyDocumentSettingsDrawer({
  open,
  onClose,
  profile,
  onSettingsSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: LegacyDocumentProfileId;
  onSettingsSaved?: () => void;
}) {
  const invalidate = useInvalidateQuery();
  const { data: settingsRes, isLoading } = useApiQuery<LegacyDocumentSettings>(
    ['legacy-document-settings', profile],
    `/inventory/legacy-document-settings/${profile}`,
    undefined,
    { enabled: open }
  );
  const [form, setForm] = useState<Partial<LegacyDocumentSettings>>({});

  useEffect(() => {
    if (settingsRes?.data) setForm(settingsRes.data);
  }, [settingsRes?.data]);

  const save = useApiMutation<LegacyDocumentSettings, Partial<LegacyDocumentSettings>>(
    `/inventory/legacy-document-settings/${profile}`,
    'PATCH',
    {
      onSuccess: () => {
        toast.success('تم حفظ إعدادات المستند');
        invalidateAfterLegacyDocumentSettingsSave(invalidate, profile);
        onSettingsSaved?.();
      },
    }
  );

  const title = LEGACY_DOCUMENT_PROFILE_TITLES[profile];

  return (
    <MasterEntitySideDrawer open={open} onClose={onClose} title={title} subtitle="الترقيم والترحيل والطباعة">
      <div className="space-y-4" dir="rtl">
        <p className="text-sm text-slate-500">تُطبَّق على المستندات الجديدة بعد الحفظ.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#0A3D5E]">نوع الترقيم</p>
            <div className="flex gap-2">
              {(
                [
                  ['AUTOMATIC', 'تلقائي'],
                  ['MANUAL', 'يدوي'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, numberingMode: id }))}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                    form.numberingMode === id
                      ? 'border-[#0E78AA] bg-[#0E78AA]/10 text-[#0E78AA]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#0A3D5E]">سلسلة الترقيم</p>
            <div className="flex gap-2">
              {(
                [
                  ['CONTINUOUS', 'متصل'],
                  ['ANNUAL_RESET', 'سنوي'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, sequenceMode: id }))}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                    form.sequenceMode === id
                      ? 'border-[#0E78AA] bg-[#0E78AA]/10 text-[#0E78AA]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <SwitchRow
          checked={form.autoPostOnSave === true}
          onChange={(v) => setForm((p) => ({ ...p, autoPostOnSave: v }))}
          label="الترحيل التلقائي عند الحفظ"
          hint="زر الحفظ يصبح «حفظ وترحيل» عند التفعيل."
        />
        <SwitchRow
          checked={form.autoPrintOnSave === true}
          onChange={(v) => setForm((p) => ({ ...p, autoPrintOnSave: v }))}
          label="الطباعة التلقائية بعد الحفظ"
          hint="فتح نافذة الطباعة بعد نجاح الحفظ."
        />
        <SwitchRow
          checked={form.generateEntryOnSave !== false}
          onChange={(v) => setForm((p) => ({ ...p, generateEntryOnSave: v }))}
          label="توليد قيد محاسبي عند الترحيل"
          hint="إيقافه يترك أثر المخزون دون قيد يومية تلقائي."
        />
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">المخزن الافتراضي</label>
          <WarehouseSelect
            value={form.defaultWarehouseId ?? ''}
            onChange={(id) => setForm((p) => ({ ...p, defaultWarehouseId: id || null }))}
          />
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={save.isPending || isLoading}
          onClick={() => save.mutate(form)}
        >
          حفظ الإعدادات
        </Button>
      </div>
    </MasterEntitySideDrawer>
  );
}
