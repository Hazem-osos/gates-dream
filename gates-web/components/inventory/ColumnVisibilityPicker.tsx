'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CUSTOMIZABLE_INVOICE_COLUMNS,
  loadVisibleColumnIds,
  saveVisibleColumnIds,
  toggleColumn,
  type InvoiceColumnStorageKey,
  type InvoiceLineColumnId,
} from '@/lib/invoices/invoiceLineColumns';

type Props = {
  storageKey: InvoiceColumnStorageKey;
  visibleIds: InvoiceLineColumnId[];
  onChange: (ids: InvoiceLineColumnId[]) => void;
  companyId?: string | null;
};

export function ColumnVisibilityPicker({ storageKey, visibleIds, onChange, companyId }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChange(loadVisibleColumnIds(storageKey, companyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per company/storage
  }, [storageKey, companyId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleToggle = (columnId: InvoiceLineColumnId, locked?: boolean) => {
    if (locked) return;
    const next = toggleColumn(visibleIds, columnId);
    saveVisibleColumnIds(storageKey, next, companyId);
    onChange(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span aria-hidden>⚙️</span>
        تخصيص الأعمدة
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 text-right shadow-lg"
          dir="rtl"
        >
          <p className="mb-2 text-xs text-slate-500">كل أعمدة جدول الأصناف — الثابتة تبقى ظاهرة دائمًا</p>
          <ul className="max-h-80 space-y-1.5 overflow-y-auto">
            {CUSTOMIZABLE_INVOICE_COLUMNS.map((col) => (
              <li key={col.id}>
                <label
                  className={`flex items-center gap-2 text-sm text-[#0A3D5E] ${
                    col.locked ? 'cursor-default opacity-70' : 'cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visibleIds.includes(col.id)}
                    disabled={col.locked}
                    onChange={() => handleToggle(col.id, col.locked)}
                    className="rounded border-gray-300"
                  />
                  {col.labelAr}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
