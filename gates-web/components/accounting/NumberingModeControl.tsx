'use client';

import { useState } from 'react';
import { useAccountingSettingsMutation } from '@/lib/hooks/useAccountingSettings';
import { apiClient } from '@/lib/api/client';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';

type Kind = 'accounts' | 'costCenters' | 'items';

const KIND_LABEL: Record<Kind, string> = {
  accounts: 'الحسابات',
  costCenters: 'مراكز التكلفة',
  items: 'الأصناف',
};

export function NumberingModeControl({
  kind,
  auto,
  recordCount,
  settingKey,
}: {
  kind: Kind;
  auto: boolean;
  recordCount: number;
  settingKey: 'coaAutoNumbering' | 'costCenterAutoNumbering' | 'itemAutoNumbering';
}) {
  const settingsMut = useAccountingSettingsMutation();
  const invalidate = useInvalidateQuery();
  const [resetting, setResetting] = useState(false);
  const locked = recordCount > 0;

  const apply = (next: boolean) => {
    if (next === auto) return;
    if (locked) {
      toast.error(`لا يمكن تغيير الترقيم بعد حفظ ${recordCount} سجل من ${KIND_LABEL[kind]}.`);
      return;
    }
    settingsMut.mutate({ general: { [settingKey]: next } });
  };

  const resetRecords = async () => {
    if (
      !(await confirmAction(
        `حذف سجلات ${KIND_LABEL[kind]} حتى تقدر تغيّر الترقيم؟ السجلات المرتبطة بحركة مش هتتمسح.`
      ))
    ) {
      return;
    }
    setResetting(true);
    try {
      const res = await apiClient.post<{ deleted: number; remaining: number }>(
        '/accounting/settings/numbering-reset',
        { kind }
      );
      toast.success(res.message || 'تم حذف السجلات');
      invalidate(['accounting-settings']);
      invalidate(['cost-centers']);
      invalidate(['accounts']);
      invalidate(['chart-of-accounts']);
      invalidate(['items']);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر حذف السجلات');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
      <span>الترقيم</span>
      <select
        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-[#0A3D5E] disabled:cursor-not-allowed disabled:opacity-60"
        value={auto ? 'auto' : 'manual'}
        disabled={locked || settingsMut.isPending}
        onChange={(e) => apply(e.target.value === 'auto')}
      >
        <option value="auto">تلقائي</option>
        <option value="manual">يدوي</option>
      </select>
      {locked ? (
        <>
          <span className="text-[11px] font-medium text-amber-700">
            محفوظ {recordCount} — لا يمكن التغيير
          </span>
          <button
            type="button"
            disabled={resetting}
            onClick={() => void resetRecords()}
            className="rounded-md border border-red-200 bg-white px-2 py-0.5 text-[11px] font-bold text-red-700 disabled:opacity-50"
          >
            {resetting ? 'جاري الحذف…' : 'حذف السجلات'}
          </button>
        </>
      ) : null}
    </div>
  );
}
