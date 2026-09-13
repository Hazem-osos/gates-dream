'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReportColumnDef } from '@/lib/reportEngine/reportColumns';

type Props = {
  columns: ReportColumnDef[];
  visibleIds: string[];
  onToggle: (id: string, visible: boolean) => void;
  onSelectAll: () => void;
  onSelectRecommended: () => void;
};

export function ReportColumnPicker({
  columns,
  visibleIds,
  onToggle,
  onSelectAll,
  onSelectRecommended,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = columns.filter((c) =>
    c.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="relative no-print" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        <span aria-hidden>⚙️</span>
        تخصيص الأعمدة
      </button>

      {open ? (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 max-h-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col">
          <div className="p-3 border-b border-slate-100">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في الأعمدة…"
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 text-right"
              dir="rtl"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={onSelectAll}
                className="flex-1 text-xs py-1.5 rounded-md bg-slate-100 hover:bg-slate-200"
              >
                تحديد الكل
              </button>
              <button
                type="button"
                onClick={onSelectRecommended}
                className="flex-1 text-xs py-1.5 rounded-md bg-sky-50 text-sky-800 hover:bg-sky-100"
              >
                العرض الافتراضي
              </button>
            </div>
          </div>
          <ul className="overflow-y-auto p-2 space-y-1 flex-1">
            {filtered.map((col) => {
              const checked = visibleIds.includes(col.id);
              return (
                <li key={col.id}>
                  <label className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm text-right">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onToggle(col.id, e.target.checked)}
                      className="shrink-0"
                    />
                    <span className="flex-1">{col.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
