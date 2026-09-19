'use client';

import type { ReactNode } from 'react';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { compactControlClass, compactLabelClass } from '@/components/ui/forms/formTokens';
import type { StatusTone } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/ui/skeletons';

export function ManufacturingPageChrome({
  title,
  breadcrumbs,
  children,
  statusLabel = 'جديد',
  docNumber,
  currentId,
  favoriteHref,
  onSave,
  savePending,
  canSave = true,
  saveLabel = 'حفظ',
  extraActions,
  hideSave = false,
  statusTone = 'info',
}: {
  title: string;
  breadcrumbs?: { href?: string; label: string }[];
  children: ReactNode;
  statusLabel?: string;
  statusTone?: StatusTone;
  docNumber?: string;
  currentId?: string | null;
  favoriteHref?: string;
  onSave?: () => void;
  savePending?: boolean;
  canSave?: boolean;
  saveLabel?: string;
  extraActions?: ReactNode;
  hideSave?: boolean;
}) {
  const crumbs = breadcrumbs ?? [{ href: '/manufacturing', label: 'التصنيع والإنتاج' }, { label: title }];

  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={crumbs}
        title={title}
        showDocumentRef={Boolean(docNumber)}
        docNumber={docNumber}
        statusTone={statusTone}
        statusLabel={statusLabel}
        saveLabel={saveLabel}
        onSaveDraft={hideSave ? undefined : onSave}
        savePending={savePending}
        canSave={Boolean(onSave) && canSave && !savePending}
        hideStandalonePost
        hideBrowseList
        hideActionMenu
        extraActions={extraActions}
        currentId={currentId}
        favoriteHref={favoriteHref}
        favoriteLabel={title}
      />
      <div className="space-y-4">{children}</div>
    </ErpDocumentLayout>
  );
}

export function MfgFilterCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-[#D6EAF3] bg-white p-4 shadow-sm', className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

export function MfgField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block min-w-0 space-y-1', className)}>
      <span className={compactLabelClass}>{label}</span>
      {children}
    </label>
  );
}

export const mfgInputClass = compactControlClass;

export function MfgMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  return (
    <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums',
          tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-[#0A3D5E]'
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function MfgTableCard({
  title,
  toolbar,
  children,
}: {
  title?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-sm">
      {title || toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6F0F7] bg-[#F8FBFD] px-4 py-3">
          {title ? <h2 className="text-sm font-bold text-[#0A3D5E]">{title}</h2> : <span />}
          {toolbar}
        </div>
      ) : null}
      <div className="-mx-0 overflow-x-auto">{children}</div>
    </section>
  );
}

export const mfgTableClass = 'min-w-full text-right text-sm';
export const mfgTheadClass = 'bg-[#F4F9FC] text-[11px] font-bold uppercase tracking-wide text-[#0A3D5E]';
export const mfgThClass = 'whitespace-nowrap border-b border-[#D6EAF3] px-3 py-2.5';
export const mfgTdClass = 'whitespace-nowrap border-b border-[#EEF5F9] px-3 py-2.5 text-[#0A3D5E]';
export const mfgTrClass = 'hover:bg-[#F8FBFD]';

export function MfgEmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}

export function MfgSkeleton() {
  return <PageSkeleton variant="workspace" tiles={4} className="min-h-0 bg-transparent p-0" />;
}
