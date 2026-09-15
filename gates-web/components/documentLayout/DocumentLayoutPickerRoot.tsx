'use client';

import { useEffect, useState } from 'react';
import { DOCUMENT_TYPE_LABELS, type DocumentLayoutConfig } from '@/lib/documentLayout/types';
import {
  GATES_PICK_LAYOUT_EVENT,
  layoutDisplayName,
  type PickLayoutDetail,
} from '@/lib/documentLayout/pickSavedDocumentLayout';

export function DocumentLayoutPickerRoot() {
  const [detail, setDetail] = useState<PickLayoutDetail | null>(null);

  useEffect(() => {
    const onPick = (event: Event) => {
      const next = (event as CustomEvent<PickLayoutDetail>).detail;
      if (!next?.resolve) return;
      setDetail(next);
    };
    window.addEventListener(GATES_PICK_LAYOUT_EVENT, onPick);
    return () => window.removeEventListener(GATES_PICK_LAYOUT_EVENT, onPick);
  }, []);

  if (!detail) return null;

  const finish = (layout: DocumentLayoutConfig | null) => {
    detail.resolve(layout);
    setDetail(null);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 className="mb-1 text-lg font-bold text-[#0A3D5E]">اختَر شكل الطباعة</h2>
        <p className="mb-4 text-xs text-slate-500">الأشكال اللي حفظتها في تخطيط المستندات.</p>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {detail.layouts.map((layout) => (
            <button
              key={layout.id || layout.name}
              type="button"
              onClick={() => finish(layout)}
              className="flex w-full items-center justify-between rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2.5 text-right hover:border-[#0E79AA]"
            >
              <span>
                <span className="block text-sm font-semibold text-[#094C6B]">{layoutDisplayName(layout)}</span>
                <span className="block text-[11px] text-slate-500">
                  {DOCUMENT_TYPE_LABELS[layout.documentType]}
                </span>
              </span>
              {layout.isDefault ? (
                <span className="rounded-full bg-[#0E79AA]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0E79AA]">
                  افتراضي
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => finish(null)}
          className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-500"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
