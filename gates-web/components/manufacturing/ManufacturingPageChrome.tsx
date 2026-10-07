'use client';

import type { ReactNode } from 'react';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import type { DocumentActionMenuProps } from '@/components/common/document-shell';
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
  onBrowseList,
  browseListLabel = 'السابق',
  hideBrowseList,
  standardActions,
  saveDisabledHint,
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
  onBrowseList?: () => void;
  browseListLabel?: string;
  hideBrowseList?: boolean;
  standardActions?: DocumentActionMenuProps;
  saveDisabledHint?: string;
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
        saveDisabledHint={saveDisabledHint}
        hideStandalonePost
        hideBrowseList={hideBrowseList ?? !onBrowseList}
        onBrowseList={onBrowseList}
        browseListLabel={browseListLabel}
        hideActionMenu={!standardActions}
        standardActions={standardActions}
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

/** Scrollable table area — ~2+ data rows visible, grows with scroll for more lines. */
export const mfgTableScrollViewportClass = cn(
  'min-h-[13rem] max-h-[min(30rem,62vh)] overflow-auto overscroll-contain px-1 pb-2'
);

export function MfgTableCard({
  title,
  toolbar,
  children,
  scrollViewport = false,
}: {
  title?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  scrollViewport?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-sm">
      {title || toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6F0F7] bg-[#F8FBFD] px-4 py-3">
          {title ? <h2 className="text-sm font-bold text-[#0A3D5E]">{title}</h2> : <span />}
          {toolbar}
        </div>
      ) : null}
      <div
        className={cn('-mx-0 overflow-x-auto', scrollViewport && mfgTableScrollViewportClass)}
      >
        {children}
      </div>
    </section>
  );
}

export const mfgTableClass = 'min-w-full border-separate border-spacing-0 text-right text-sm';
export const mfgTheadClass = 'bg-[#0E78AA] text-xs font-semibold uppercase tracking-wide text-white';
export const mfgTheadStickyClass = cn(mfgTheadClass, 'sticky top-0 z-10 shadow-sm');
export const mfgThClass =
  'whitespace-nowrap border-b border-white/15 px-3 py-3 text-right last:border-e-0 border-e border-white/15';
export const mfgTdClass =
  'whitespace-nowrap border-b border-[#EEF5F9] px-3 py-3 text-[#0A3D5E] align-middle min-h-[2.75rem]';
export const mfgTrClass = 'bg-white hover:bg-[#F8FBFD]';

export const mfgThIdx = cn(mfgThClass, 'w-11 text-center');
export const mfgThItem = cn(mfgThClass, 'min-w-[12rem]');
export const mfgThAvail = cn(mfgThClass, 'min-w-[6.5rem] text-center');
export const mfgThQty = cn(mfgThClass, 'min-w-[8.5rem] w-[8.5rem] text-center');
export const mfgThUnit = cn(mfgThClass, 'min-w-[5rem] text-center');
export const mfgThMoney = cn(mfgThClass, 'min-w-[9rem] w-[9rem] text-end');
export const mfgTdNum = cn(mfgTdClass, 'tabular-nums text-end font-semibold text-[#094C6B]');
export const mfgTdIdx = cn(mfgTdClass, 'text-center text-slate-500 tabular-nums');

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
