'use client';

import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { cn } from '@/lib/utils';
import type { WarehouseKind } from '@/lib/inventory/warehouse-kind';

type Props = {
  open: boolean;
  parentLabel: string;
  onClose: () => void;
  onPick: (kind: WarehouseKind) => void;
};

export function ChildWarehouseKindDialog({ open, parentLabel, onClose, onPick }: Props) {
  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="child-warehouse-kind-title">
      <div className="p-6" dir="rtl">
        <h2 id="child-warehouse-kind-title" className="text-lg font-bold text-[#0E79AA]">
          نوع المخزن الفرعي
        </h2>
        <p className="mt-1 text-sm text-slate-500">تحت: {parentLabel}</p>
        <div className="mt-5 grid gap-3">
          <button
            type="button"
            className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
            onClick={() => onPick('POSTING')}
          >
            <span className="block text-sm font-bold text-[#0A3D5E]">عمليات</span>
            <span className="mt-1 block text-xs text-slate-500">
              مخزن حركة يظهر في الفواتير والأذون. ممنوع التفريع منه.
            </span>
          </button>
          <button
            type="button"
            className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
            onClick={() => onPick('HEADER')}
          >
            <span className="block text-sm font-bold text-[#0A3D5E]">رئيسي فرعي</span>
            <span className="mt-1 block text-xs text-slate-500">
              مجموعة في الشجرة فقط. ينفع تضيف تحته عمليات أو رئيسي فرعي تاني.
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

export function WarehouseKindLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 text-[11px] text-slate-600', className)}
      aria-label="مفتاح أنواع المخزن"
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-900 ring-1 ring-sky-300">
          رئيسي
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-900 ring-1 ring-indigo-300">
          رئيسي فرعي
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-full bg-teal-100 px-2 py-0.5 font-semibold text-teal-900 ring-1 ring-teal-300">
          عمليات
        </span>
      </span>
    </div>
  );
}
