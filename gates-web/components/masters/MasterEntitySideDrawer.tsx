'use client';

import { ReactNode } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';

export function MasterEntitySideDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <CenteredOverlay open={open} onClose={onClose} width="xl" labelledBy="master-entity-dialog-title">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-5">
        <div className="min-w-0">
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          <h2 id="master-entity-dialog-title" className="mt-1 text-lg font-bold text-slate-900">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="إغلاق"
        >
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
      {footer ? <footer className="shrink-0 border-t border-slate-200 p-4">{footer}</footer> : null}
    </CenteredOverlay>
  );
}
