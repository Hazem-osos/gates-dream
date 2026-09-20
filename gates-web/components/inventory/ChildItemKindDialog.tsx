'use client';

import { CenteredOverlay } from '@/components/erp/CenteredOverlay';

type Props = {
  open: boolean;
  parentLabel: string;
  onClose: () => void;
  onPick: (kind: 'group' | 'item') => void;
};

export function ChildItemKindDialog({ open, parentLabel, onClose, onPick }: Props) {
  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="child-item-kind-title">
      <div className="p-6" dir="rtl">
        <h2 id="child-item-kind-title" className="text-lg font-bold text-[#0E79AA]">
          هتضيف إيه تحت المجموعة؟
        </h2>
        <p className="mt-1 text-sm text-slate-500">تحت: {parentLabel}</p>
        <div className="mt-5 grid gap-3">
          <button
            type="button"
            className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
            onClick={() => onPick('group')}
          >
            <span className="block text-sm font-bold text-[#0A3D5E]">مجموعة</span>
            <span className="mt-1 block text-xs text-slate-500">
              مجموعة فرعية في الدليل. ينفع تضيف تحتها مجموعات أو أصناف.
            </span>
          </button>
          <button
            type="button"
            className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
            onClick={() => onPick('item')}
          >
            <span className="block text-sm font-bold text-[#0A3D5E]">صنف</span>
            <span className="mt-1 block text-xs text-slate-500">
              صنف يظهر في الفواتير والأذون تحت هذه المجموعة.
            </span>
          </button>
        </div>
        <button type="button" className="mt-4 text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </CenteredOverlay>
  );
}
