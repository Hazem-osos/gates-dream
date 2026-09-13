'use client';

import type { SavedView, SavedViewFilterState } from '@/lib/hooks/useSavedViews';

type Props = {
  views: SavedView[];
  activeViewId: string | null;
  onSelectView: (view: SavedView | null) => void;
  onSaveCurrent: (name: string) => void;
  onRemoveView?: (id: string) => void;
  currentFilterSummary?: string;
};

export function SmartFilterTabs({
  views,
  activeViewId,
  onSelectView,
  onSaveCurrent,
  onRemoveView,
}: Props) {
  const handleSave = () => {
    const name = window.prompt('اسم طريقة العرض (مثال: فواتير غير مسددة +30 يوم)');
    if (name?.trim()) onSaveCurrent(name.trim());
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3" dir="rtl">
      <button
        type="button"
        onClick={() => onSelectView(null)}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
          activeViewId === null
            ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
        }`}
      >
        الكل
      </button>
      {views.map((v) => (
        <span key={v.id} className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onSelectView(v)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
              activeViewId === v.id
                ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {v.name}
          </button>
          {onRemoveView ? (
            <button
              type="button"
              className="text-slate-400 hover:text-red-600 text-xs px-1"
              aria-label={`حذف ${v.name}`}
              onClick={() => onRemoveView(v.id)}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      <button
        type="button"
        onClick={handleSave}
        className="rounded-full px-3 py-1.5 text-xs font-medium border border-dashed border-sky-300 text-sky-800 bg-sky-50/80 hover:bg-sky-50"
      >
        💾 حفظ كطريقة عرض جديدة
      </button>
    </div>
  );
}

export type { SavedViewFilterState };
