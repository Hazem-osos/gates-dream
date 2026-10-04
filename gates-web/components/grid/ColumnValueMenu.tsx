'use client';

import { useEffect, useRef } from 'react';

type SortDirection = 'asc' | 'desc';

export function ColumnValueMenu({
  label,
  values,
  selected,
  sortDirection,
  anchor,
  onClose,
  onSort,
  onSelected,
  onClear,
  showSort = true,
}: {
  label: string;
  values: string[];
  selected: string[];
  sortDirection: SortDirection | null;
  anchor: { top: number; right: number };
  onClose: () => void;
  onSort: (direction: SortDirection | null) => void;
  onSelected: (selected: string[]) => void;
  onClear: () => void;
  showSort?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!values.length) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-56 rounded-lg border border-slate-200 bg-white p-2 text-right shadow-lg"
      style={{ top: anchor.top, right: anchor.right }}
      dir="rtl"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <button type="button" className="text-[11px] text-sky-700" onClick={onClear}>
          مسح
        </button>
      </div>
      {showSort ? <div className="mb-2 flex gap-1">
        <button
          type="button"
          className={`h-7 flex-1 rounded border text-[11px] ${
            sortDirection === 'asc' ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-700'
          }`}
          onClick={() => onSort(sortDirection === 'asc' ? null : 'asc')}
        >
          تصاعدي
        </button>
        <button
          type="button"
          className={`h-7 flex-1 rounded border text-[11px] ${
            sortDirection === 'desc' ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-700'
          }`}
          onClick={() => onSort(sortDirection === 'desc' ? null : 'desc')}
        >
          تنازلي
        </button>
      </div> : null}
      <div className="max-h-48 space-y-1 overflow-auto">
        {values.map((value) => {
          const checked = selected.includes(value);
          return (
            <label key={value} className="flex items-center gap-2 text-xs text-slate-800">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked ? selected.filter((item) => item !== value) : [...selected, value];
                  onSelected(next);
                }}
              />
              <span className="truncate">{value}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
