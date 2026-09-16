'use client';

import { useEffect, useState } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';

export type PartyGuideAddChoice =
  | 'customer'
  | 'supplier'
  | 'delegate'
  | 'customer-group'
  | 'supplier-group';

type Props = {
  open: boolean;
  /** Current guide tab — used only as a hint, the user still picks. */
  currentKind?: 'customers' | 'suppliers';
  onPick: (choice: PartyGuideAddChoice) => void;
  onClose: () => void;
};

const PERSON_OPTIONS: { id: Extract<PartyGuideAddChoice, 'customer' | 'supplier' | 'delegate'>; title: string; description: string }[] = [
  {
    id: 'customer',
    title: 'عميل',
    description: 'بطاقة عميل كاملة — تظهر في شجرة العملاء.',
  },
  {
    id: 'supplier',
    title: 'مورد',
    description: 'بطاقة مورد كاملة — تظهر في شجرة الموردين.',
  },
  {
    id: 'delegate',
    title: 'مندوب',
    description: 'يفتح بطاقة المندوب في دليل التوزيع.',
  },
];

export function PartyGuideAddDialog({ open, currentKind, onPick, onClose }: Props) {
  const [step, setStep] = useState<'kind' | 'group'>('kind');

  useEffect(() => {
    if (open) setStep('kind');
  }, [open]);

  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="party-guide-add-title">
      <div className="p-6" dir="rtl">
        <h2 id="party-guide-add-title" className="text-lg font-bold text-[#0E79AA]">
          {step === 'group' ? 'نوع المجموعة' : 'إضافة في الدليل'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {step === 'group'
            ? 'المجموعة دي لعملاء ولا لموردين؟ اختار بنفسك — مش بتتقيد بالفلتر.'
            : 'عايز تضيف عميل، مورد، مندوب، ولا مجموعة؟'}
        </p>

        {step === 'kind' ? (
          <div className="mt-5 grid gap-3">
            {PERSON_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
                onClick={() => onPick(item.id)}
              >
                <span className="block text-sm font-bold text-[#0A3D5E]">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
              </button>
            ))}
            <button
              type="button"
              className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
              onClick={() => setStep('group')}
            >
              <span className="block text-sm font-bold text-[#0A3D5E]">مجموعة</span>
              <span className="mt-1 block text-xs text-slate-500">
                كود واسم فقط. بعدين تختار هي مجموعة عملاء ولا موردين.
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white ${
                currentKind === 'customers'
                  ? 'border-[#0E79AA] bg-white'
                  : 'border-[#D6EAF3] bg-[#F6FBFD]'
              }`}
              onClick={() => onPick('customer-group')}
            >
              <span className="block text-sm font-bold text-[#0A3D5E]">مجموعة عملاء</span>
              <span className="mt-1 block text-xs text-slate-500">
                تظهر في تاب العملاء، ويتضاف تحتها عملاء.
                {currentKind === 'customers' ? ' — الفلتر الحالي.' : ''}
              </span>
            </button>
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white ${
                currentKind === 'suppliers'
                  ? 'border-[#0E79AA] bg-white'
                  : 'border-[#D6EAF3] bg-[#F6FBFD]'
              }`}
              onClick={() => onPick('supplier-group')}
            >
              <span className="block text-sm font-bold text-[#0A3D5E]">مجموعة موردين</span>
              <span className="mt-1 block text-xs text-slate-500">
                تظهر في تاب الموردين، ويتضاف تحتها موردين.
                {currentKind === 'suppliers' ? ' — الفلتر الحالي.' : ''}
              </span>
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          {step === 'group' ? (
            <button
              type="button"
              className="text-sm text-[#0E79AA] hover:underline"
              onClick={() => setStep('kind')}
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
