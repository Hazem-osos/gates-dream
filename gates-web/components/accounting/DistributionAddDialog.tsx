'use client';

import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { STAFF_CARD_KINDS, type StaffCardKind } from '@/components/accounting/StaffCardKindDialog';

export type DistributionNodeKind = 'GROUP' | 'PERSON';

type Step = 'node' | 'person';

type Props = {
  open: boolean;
  parentLabel?: string | null;
  step: Step;
  onStepChange: (step: Step) => void;
  onPickGroup: () => void;
  onPickPerson: (kind: StaffCardKind) => void;
  onClose: () => void;
};

export function DistributionAddDialog({
  open,
  parentLabel,
  step,
  onStepChange,
  onPickGroup,
  onPickPerson,
  onClose,
}: Props) {
  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="distribution-add-title">
      <div className="p-6" dir="rtl">
        <h2 id="distribution-add-title" className="text-lg font-bold text-[#0E79AA]">
          {step === 'person' ? 'نوع الفرد' : 'إضافة في الدليل'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {parentLabel
            ? `تحت «${parentLabel}» — مجموعة زي حساب رئيسي (كود واسم)، أو فرد ببطاقة كاملة.`
            : 'مجموعة زي حساب رئيسي (كود واسم فقط)، أو فرد يفتح بطاقة مندوب / سائق / موزع.'}
        </p>

        {step === 'node' ? (
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
              onClick={onPickGroup}
            >
              <span className="block text-sm font-bold text-[#0A3D5E]">مجموعة</span>
              <span className="mt-1 block text-xs text-slate-500">
                مجلد في الشجرة — كود واسم فقط، وينفع تضيف تحته مجموعات أو أفراد.
              </span>
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
              onClick={() => onStepChange('person')}
            >
              <span className="block text-sm font-bold text-[#0A3D5E]">فرد</span>
              <span className="mt-1 block text-xs text-slate-500">مندوب أو سائق أو موزع — بطاقة كاملة.</span>
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {STAFF_CARD_KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
                onClick={() => onPickPerson(item.id)}
              >
                <span className="block text-sm font-bold text-[#0A3D5E]">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          {step === 'person' ? (
            <button
              type="button"
              className="text-sm text-[#0E79AA] hover:underline"
              onClick={() => onStepChange('node')}
            >
              رجوع
            </button>
          ) : null}
          <button type="button" className="text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </CenteredOverlay>
  );
}
