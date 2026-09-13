'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  denseTableClass,
  denseTableWrapClass,
  denseTdClass,
  denseThClass,
  denseTheadClass,
  denseTrClass,
} from '@/components/ui';
import { DashboardEmptyState } from '@/components/dashboard-primitives/DashboardEmptyState';
import { DASHBOARD_CARD_CLASS } from './chrome';
import type { ActivityColumn } from './types';

export function CompactActivityTable<T extends { id: string }>({
  title,
  rows,
  columns,
  hrefOf,
  loading,
  emptyTitle = 'لا يوجد نشاط حديث',
  emptyActionHref,
  emptyActionLabel,
  className,
}: {
  title: string;
  rows: T[];
  columns: ActivityColumn<T>[];
  hrefOf?: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
  className?: string;
}) {
  return (
    <section className={cn(DASHBOARD_CARD_CLASS, 'p-4', className)} dir="rtl">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {loading ? (
        <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
      ) : rows.length === 0 ? (
        <DashboardEmptyState title={emptyTitle} actionHref={emptyActionHref} actionLabel={emptyActionLabel} />
      ) : (
        <div className={denseTableWrapClass}>
          <table className={denseTableClass}>
            <thead className={denseTheadClass}>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={cn(denseThClass, col.numeric && 'min-w-[100px]', col.className)}
                  >
                    {col.header}
                  </th>
                ))}
                {hrefOf ? <th className={denseThClass}>إجراء</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={denseTrClass}>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        denseTdClass,
                        col.numeric && 'min-w-[100px] font-mono tabular-nums',
                        col.className
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                  {hrefOf ? (
                    <td className={denseTdClass}>
                      <Link
                        href={hrefOf(row)}
                        className="inline-flex h-7 items-center gap-1 rounded-md text-[11px] font-semibold text-[#0E79AA] hover:underline"
                      >
                        فتح
                        <ChevronLeft className="h-3 w-3" aria-hidden />
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
