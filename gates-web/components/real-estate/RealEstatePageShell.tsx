'use client';

import type { ReactNode } from 'react';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/ui/skeletons';

export function RealEstatePageShell({ children }: { children: React.ReactNode }) {
  return (
    <ErpDocumentLayout>
      <div className="space-y-4">{children}</div>
    </ErpDocumentLayout>
  );
}

export function RealEstateWorkspaceHeader({
  title,
  breadcrumbs,
  extraActions,
  statusLabel = 'قائمة',
  docNumber,
  currentId,
  favoriteHref,
}: {
  title: string;
  breadcrumbs: { href?: string; label: string }[];
  extraActions?: ReactNode;
  statusLabel?: string;
  docNumber?: string;
  currentId?: string | null;
  favoriteHref?: string;
}) {
  return (
    <ErpDocumentPageHeader
      compact
      lockWhenPosted={false}
      breadcrumbs={breadcrumbs}
      title={title}
      showDocumentRef={Boolean(docNumber)}
      docNumber={docNumber}
      statusTone="info"
      statusLabel={statusLabel}
      hideStandalonePost
      hideBrowseList
      extraActions={extraActions}
      hideActionMenu
      currentId={currentId}
      favoriteHref={favoriteHref}
      favoriteLabel={title}
    />
  );
}

export function ReCard({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm', className)}>
      {children}
    </section>
  );
}

export function ReMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'success';
}) {
  return (
    <div className="rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-bold tabular-nums',
          tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-[#094C6B]'
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ReSkeleton() {
  return <PageSkeleton variant="workspace" tiles={4} className="min-h-0 bg-transparent p-0" />;
}
