'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './TableSkeleton';
import { TablePagination, type TablePaginationProps } from './TablePagination';
import { TableExportActions } from './TableExportActions';
import {
  appTableColumnsToExport,
  type ExportColumnDef,
} from '@/lib/export/export-utils';

export type AppTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  accessor?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  align?: 'start' | 'center' | 'end';
  numeric?: boolean;
  className?: string;
  headerClassName?: string;
};

export interface AppTableProps<T extends Record<string, unknown>> {
  columns: AppTableColumn<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  stickyHeader?: boolean;
  pagination?: TablePaginationProps;
  className?: string;
  skeletonRows?: number;
  exportFileName?: string;
  exportColumns?: ExportColumnDef<T>[];
  /** Hover / focus intent — used to prefetch the row's detail query. */
  onRowIntent?: (row: T) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  virtualizeThreshold?: number;
}

function formatCellValue(value: unknown, numeric?: boolean): React.ReactNode {
  if (value == null || value === '') return '—';
  if (numeric && typeof value === 'number') {
    return value.toLocaleString('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  return String(value);
}

function useClientMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

export function AppTable<T extends Record<string, unknown>>({
  columns,
  data,
  getRowKey,
  isLoading,
  emptyTitle,
  emptyDescription,
  stickyHeader = true,
  pagination,
  className,
  skeletonRows = 6,
  exportFileName,
  exportColumns,
  onRowIntent,
  onRowClick,
  rowClassName,
  virtualizeThreshold = 40,
}: AppTableProps<T>) {
  const mounted = useClientMounted();
  const showSkeleton = !mounted || Boolean(isLoading);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const useVirtual = !showSkeleton && data.length >= virtualizeThreshold;

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
    enabled: useVirtual,
  });

  if (showSkeleton) {
    return <TableSkeleton rows={skeletonRows} columns={columns.length} className={className} />;
  }

  const resolvedExportColumns =
    exportColumns ??
    (exportFileName ? appTableColumnsToExport(columns) : undefined);

  const renderCells = (row: T, rowIndex: number) =>
    columns.map((col) => {
      let content: React.ReactNode;
      if (col.cell) {
        content = col.cell(row, rowIndex);
      } else if (col.accessor) {
        content = formatCellValue(row[col.accessor], col.numeric);
      } else {
        content = '—';
      }
      return (
        <td
          key={col.id}
          className={cn(
            'max-w-[280px] truncate px-3 h-10 text-slate-700 border-e border-[#E8F1F6] last:border-e-0',
            col.align === 'end' && 'text-left',
            col.align === 'center' && 'text-center',
            col.align !== 'end' && col.align !== 'center' && 'text-right',
            col.numeric && 'min-w-[100px] tabular-nums',
            col.className
          )}
        >
          {content}
        </td>
      );
    });

  const header = (
    <thead
      className={cn(
        'h-10 bg-[#0E78AA] text-white text-xs font-semibold tracking-wider',
        stickyHeader && 'sticky top-0 z-10'
      )}
    >
      <tr>
        {columns.map((col) => (
          <th
            key={col.id}
            className={cn(
              'px-3 text-xs font-semibold tracking-wider whitespace-nowrap border-e border-white/20 last:border-e-0',
              col.align === 'end' && 'text-left',
              col.align === 'center' && 'text-center',
              col.align !== 'end' && col.align !== 'center' && 'text-right',
              col.numeric && 'min-w-[100px] tabular-nums',
              col.headerClassName
            )}
          >
            {col.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  let body: React.ReactNode;
  if (data.length === 0) {
    body = (
      <tbody>
        <tr>
          <td colSpan={columns.length}>
            <EmptyState title={emptyTitle} description={emptyDescription} />
          </td>
        </tr>
      </tbody>
    );
  } else if (useVirtual) {
    body = (
      <tbody
        className="relative block"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((vRow) => {
          const row = data[vRow.index];
          return (
            <tr
              key={getRowKey(row, vRow.index)}
              tabIndex={0}
              className={cn(
                'table w-full table-fixed absolute left-0 h-10 border-b border-[#E8F1F6] hover:bg-[#E8F4FA] transition-colors',
                vRow.index % 2 === 1 && 'bg-[#F3F9FC]',
                onRowClick && 'cursor-pointer',
                rowClassName?.(row)
              )}
              style={{ transform: `translateY(${vRow.start}px)` }}
              onMouseEnter={() => onRowIntent?.(row)}
              onFocus={() => onRowIntent?.(row)}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(e) => {
                if (!onRowClick) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(row);
                }
              }}
            >
              {renderCells(row, vRow.index)}
            </tr>
          );
        })}
      </tbody>
    );
  } else {
    body = (
      <tbody>
        {data.map((row, rowIndex) => (
          <tr
            key={getRowKey(row, rowIndex)}
            tabIndex={0}
            className={cn(
              'h-10 border-b border-[#E8F1F6] hover:bg-[#E8F4FA] transition-colors',
              rowIndex % 2 === 1 && 'bg-[#F3F9FC]',
              onRowClick && 'cursor-pointer',
              rowClassName?.(row)
            )}
            onMouseEnter={() => onRowIntent?.(row)}
            onFocus={() => onRowIntent?.(row)}
            onClick={() => onRowClick?.(row)}
            onKeyDown={(e) => {
              if (!onRowClick) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRowClick(row);
              }
            }}
          >
            {renderCells(row, rowIndex)}
          </tr>
        ))}
      </tbody>
    );
  }

  return (
    <div className={cn('flex min-w-0 w-full max-w-full flex-col gap-3', className)} dir="rtl">
      {exportFileName && resolvedExportColumns?.length ? (
        <div className="flex justify-end">
          <TableExportActions
            fileName={exportFileName}
            columns={resolvedExportColumns}
            data={data}
          />
        </div>
      ) : null}
      <div
        ref={useVirtual ? parentRef : undefined}
        className={cn(
          'erp-scroll-x min-w-0 w-full max-w-full overflow-x-auto rounded-lg border border-[#D6EAF3] bg-white',
          useVirtual && 'max-h-[480px] overflow-y-auto'
        )}
      >
        <table className="w-full min-w-[480px] border-collapse text-sm">
          {header}
          {body}
        </table>
      </div>
      {pagination ? <TablePagination {...pagination} /> : null}
    </div>
  );
}

/** Alias for design-system docs */
export const DataTable = AppTable;
