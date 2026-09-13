'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info, Search } from 'lucide-react';

export type CalculationInspectorRow = {
  label: string;
  value: string;
  tone?: 'muted' | 'plus' | 'minus' | 'total';
  hint?: string;
};

type Props = {
  title?: string;
  triggerLabel?: string;
  rows: CalculationInspectorRow[];
  footer?: ReactNode;
};

const toneClass: Record<NonNullable<CalculationInspectorRow['tone']>, string> = {
  muted: 'text-slate-600',
  plus: 'text-emerald-700',
  minus: 'text-rose-700',
  total: 'text-[#0A3D5E] font-bold',
};

const PANEL_WIDTH = 288;

function panelBox(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  const width = Math.min(PANEL_WIDTH, window.innerWidth - margin * 2);
  const estimatedHeight = 220;
  let top = rect.bottom + 6;
  if (top + estimatedHeight > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - estimatedHeight - 6);
  }
  let left = rect.right - width;
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  return { top, left, width };
}

export function CalculationInspector({
  title = 'تفاصيل الاحتساب',
  triggerLabel = 'تفاصيل الاحتساب',
  rows,
  footer,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPos(panelBox(trigger));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
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
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const panel =
    open && pos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            id={tooltipId}
            role="dialog"
            dir="rtl"
            className="fixed z-[9990] rounded-xl border border-[#D6EAF3] bg-white p-3 text-right shadow-xl"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <p className="text-[11px] font-bold text-[#0E79AA]">{title}</p>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-5">
              {rows.map((row) => (
                <li key={`${row.label}-${row.value}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500">{row.label}</span>
                    <span className={`tabular-nums ${toneClass[row.tone ?? 'muted']}`}>{row.value}</span>
                  </div>
                  {row.hint ? <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{row.hint}</p> : null}
                </li>
              ))}
            </ul>
            {footer}
          </div>,
          document.body
        )
      : null;

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={tooltipId}
        title={triggerLabel}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[#0E79AA] hover:bg-[#0E79AA]/10"
      >
        <Search className="h-3 w-3" />
        <Info className="h-3 w-3" />
        <span className="sr-only">{triggerLabel}</span>
      </button>
      {panel}
    </span>
  );
}
