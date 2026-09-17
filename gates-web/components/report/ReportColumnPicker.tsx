'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReportColumnDef } from '@/lib/reportEngine/reportColumns';

type Props = {
  columns: ReportColumnDef[];
  visibleIds: string[];
  onToggle: (id: string, visible: boolean) => void;
  onSelectAll: () => void;
  onSelectRecommended: () => void;
};

const PANEL_W = 320;

export function ReportColumnPicker({
  columns,
  visibleIds,
  onToggle,
  onSelectAll,
  onSelectRecommended,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = PANEL_W;
    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = rect.bottom + 8;
    const maxH = Math.min(window.innerHeight * 0.7, 420);
    if (top + maxH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - maxH - 8);
    }
    setPanelStyle({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => updatePosition();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = columns.filter((c) =>
    c.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const panel =
    open && panelStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            dir="rtl"
            role="dialog"
            aria-label="تخصيص أعمدة التقرير"
            className="fixed z-[40000] isolate flex max-h-[min(70vh,26rem)] w-[320px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_40px_-16px_rgba(9,76,107,0.45)]"
            style={{ top: panelStyle.top, left: panelStyle.left }}
          >
            <div className="border-b border-slate-100 bg-white p-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث في الأعمدة…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm"
                dir="rtl"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="flex-1 rounded-md bg-slate-100 py-1.5 text-xs hover:bg-slate-200"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={onSelectRecommended}
                  className="flex-1 rounded-md bg-sky-50 py-1.5 text-xs text-sky-800 hover:bg-sky-100"
                >
                  العرض الافتراضي
                </button>
              </div>
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto bg-white p-2">
              {filtered.map((col) => {
                const checked = visibleIds.includes(col.id);
                return (
                  <li key={col.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-right text-sm text-slate-800 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onToggle(col.id, e.target.checked)}
                        className="shrink-0"
                      />
                      <span className="min-w-0 flex-1 break-words">{col.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative no-print">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D6EAF3] bg-white px-3 text-xs font-semibold text-[#094C6B] hover:bg-[#F6FBFD]"
      >
        <span aria-hidden>⚙️</span>
        تخصيص الأعمدة
      </button>
      {panel}
    </div>
  );
}
