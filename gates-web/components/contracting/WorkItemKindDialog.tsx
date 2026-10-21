'use client';

import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import type { WorkItemCatalogKindUi } from '@/components/contracting/tender/tender-labels';
import { CATALOG_KIND_AR } from '@/components/contracting/tender/tender-labels';

type Props = {
  open: boolean;
  parentLabel: string;
  options: WorkItemCatalogKindUi[];
  onClose: () => void;
  onPick: (kind: WorkItemCatalogKindUi) => void;
};

const KIND_HINT: Record<WorkItemCatalogKindUi, string> = {
  SEASON: 'بند تجميعي في جذر الدليل. يمكن إضافة بنود رئيسية فرعية أو تنفيذية تحته.',
  CHAPTER: 'بند تجميعي تحت بند رئيسي. يمكن إضافة بنود تنفيذية أو رئيسية فرعية أخرى تحته.',
  EXECUTABLE: 'بند تنفيذي له كمية وسعر. لا يُفرَّع منه.',
};

export function WorkItemKindDialog({ open, parentLabel, options, onClose, onPick }: Props) {
  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="work-item-kind-title">
      <div className="p-6" dir="rtl">
        <h2 id="work-item-kind-title" className="text-lg font-bold text-[#0E78AA]">
          نوع البند
        </h2>
        <p className="mt-1 text-sm text-slate-500">تحت: {parentLabel}</p>
        <div className="mt-5 grid gap-3">
          {options.map((kind) => (
            <button
              key={kind}
              type="button"
              className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E78AA] hover:bg-white"
              onClick={() => onPick(kind)}
            >
              <span className="block text-sm font-bold text-[#0A3D5E]">{CATALOG_KIND_AR[kind]}</span>
              <span className="mt-1 block text-xs text-slate-500">{KIND_HINT[kind]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="mt-4 text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </CenteredOverlay>
  );
}
