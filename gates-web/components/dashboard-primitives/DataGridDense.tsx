'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH_LABEL, DASH_NUM, DASH_PANEL } from './tokens';
import { DashboardEmptyState } from './DashboardEmptyState';

export type DenseCol<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
  className?: string;
};

export function DataGridDense<T extends { id: string }>({
  title,
  rows,
  columns,
  loading,
  empty = 'لا توجد صفوف',
  emptyActionHref,
  emptyActionLabel,
  onRowOpen,
  footer,
}: {
  title: string;
  rows: T[];
  columns: DenseCol<T>[];
  loading?: boolean;
  empty?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
  onRowOpen?: (row: T) => void;
  footer?: ReactNode;
}) {
  const [active, setActive] = useState(0);

  const onKey = (e: KeyboardEvent<HTMLTableElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && rows[active]) {
      onRowOpen?.(rows[active]);
    }
  };

  return (
    <section className={cn(DASH_PANEL, 'overflow-hidden')}>
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs" tabIndex={0} onKeyDown={onKey}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {columns.map((c) => (
                <th
                  key={c.id}
                  className={cn(
                    DASH_LABEL,
                    'px-3 py-2 text-right font-medium',
                    c.numeric && 'text-left',
                    c.className
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">
                  جاري التحميل…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <DashboardEmptyState
                    title={empty}
                    description="ابدأ بإدخال أول مستند لتظهر الحركة هنا."
                    actionHref={emptyActionHref}
                    actionLabel={emptyActionLabel}
                  />
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/80',
                    i === active && 'bg-sky-50/70',
                    onRowOpen && 'cursor-pointer'
                  )}
                  onClick={() => {
                    setActive(i);
                    onRowOpen?.(row);
                  }}
                >
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        'px-3 py-2 align-middle',
                        c.numeric && cn(DASH_NUM, 'text-left font-semibold'),
                        c.className
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">{footer}</div> : null}
    </section>
  );
}
