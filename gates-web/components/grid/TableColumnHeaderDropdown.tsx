'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type ColumnHeaderAction = {
  id: string;
  label: string;
  onClick: () => void;
};

type Props = {
  label: string;
  actions?: ColumnHeaderAction[];
  className?: string;
};

/** Subtle bulk-action menu on numeric / dimension column headers. */
export function TableColumnHeaderDropdown({ label, actions, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!actions?.length) {
    return <span className={className}>{label}</span>;
  }

  return (
    <div ref={ref} className={`relative inline-flex items-center gap-0.5 ${className ?? ''}`}>
      <span>{label}</span>
      <button
        type="button"
        className="rounded p-0.5 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
        aria-label={`إجراءات ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-[120] mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white py-1 text-right shadow-lg text-slate-800 font-normal">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              className="block w-full px-3 py-2 text-xs hover:bg-slate-50 text-right"
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
