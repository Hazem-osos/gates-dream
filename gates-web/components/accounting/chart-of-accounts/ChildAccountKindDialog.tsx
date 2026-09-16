'use client';

import { CenteredOverlay } from '@/components/erp/CenteredOverlay';

type Props = {
  open: boolean;
  parentLabel: string;
  onClose: () => void;
  onPick: (kind: 'HEADER' | 'POSTING') => void;
};

export function ChildAccountKindDialog({ open, parentLabel, onClose, onPick }: Props) {
  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="child-account-kind-title">
      <div className="p-6" dir="rtl">
        <h2 id="child-account-kind-title" className="text-lg font-bold text-[#0E79AA]">نوع الحساب الفرعي</h2>
        <p className="mt-1 text-sm text-slate-500">تحت: {parentLabel}</p>
        <div className="mt-5 grid gap-3">
          <button
            type="button"
            className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
            onClick={() => onPick('POSTING')}
          >
            <span className="block text-sm font-bold text-[#0A3D5E]">حساب حركة</span>
            <span className="mt-1 block text-xs text-slate-500">
              يظهر في اختيار الحسابات وتُترحَّل عليه القيود. ممنوع التفريع منه.
            </span>
          </button>
          <button
            type="button"
            className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
            onClick={() => onPick('HEADER')}
          >
            <span className="block text-sm font-bold text-[#0A3D5E]">رئيسي فرعي</span>
            <span className="mt-1 block text-xs text-slate-500">
              مجموعة في الشجرة فقط. ينفع تضيف تحته حركة أو رئيسي فرعي تاني.
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
