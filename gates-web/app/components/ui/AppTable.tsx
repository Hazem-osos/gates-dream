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
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
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
  defaultSort?: { id: string; dir: 'asc' | 'desc' };
  onSortChange?: (sort: { id: string; dir: 'asc' | 'desc' }) => void;
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

function columnSortable<T extends Record<string, unknown>>(col: AppTableColumn<T>): boolean {
  if (col.sortable === false || /^(actions|action|ops|open)$/.test(col.id)) return false;
  if (col.sortable === true || col.sortValue || col.accessor) return true;
  return /serial|code|num|date|name|status|desc|total|amount/.test(col.id);
}

function parseSortable(value: unknown): string | number {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const time = Date.parse(str);
    if (!Number.isNaN(time)) return time;
  }
  const numeric = Number(str.replace(/,/g, ''));
  if (str !== '' && Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(str.replace(/,/g, ''))) {
    return numeric;
  }
  return str;
}

function inferredFieldValue<T extends Record<string, unknown>>(row: T, colId: string): unknown {
  if (row[colId] != null && row[colId] !== '') return row[colId];
  if (/num|serial|code|number/.test(colId)) {
    return (
      row.voucherNumber ??
      row.legacyGlNum ??
      row.serialNumber ??
      row.serial ??
      row.code ??
      row.invoiceNumber ??
      row.documentNumber ??
      row.entryNumber ??
      ''
    );
  }
  if (/date/.test(colId)) {
    return row.date ?? row.createdAt ?? row.openingDate ?? '';
  }
  return row[colId];
}

function columnSortValue<T extends Record<string, unknown>>(
  row: T,
  col: AppTableColumn<T>
): string | number {
  if (col.sortValue) return parseSortable(col.sortValue(row));
  if (col.accessor) return parseSortable(row[col.accessor]);
  return parseSortable(inferredFieldValue(row, col.id));
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
  defaultSort,
  onSortChange,
}: AppTableProps<T>) {
  const mounted = useClientMounted();
  const defaultSortId =
    defaultSort?.id ??
    columns.find((col) => /^(serial|code|num|number)$/.test(col.id) && columnSortable(col))?.id ??
    columns.find((col) => columnSortable(col))?.id ??
    null;
  const [sort, setSort] = React.useState<{ id: string; dir: 'asc' | 'desc' } | null>(
    defaultSortId ? { id: defaultSortId, dir: defaultSort?.dir ?? 'asc' } : null
  );
  const changeSort = (next: { id: string; dir: 'asc' | 'desc' }) => {
    setSort(next);
    onSortChange?.(next);
  };
  const serverSorted = Boolean(onSortChange);
  const sortedData = React.useMemo(() => {
    if (serverSorted || !sort) return data;
    const col = columns.find((item) => item.id === sort.id);
    if (!col || !columnSortable(col)) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const av = columnSortValue(a, col);
      const bv = columnSortValue(b, col);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'ar', { numeric: true, sensitivity: 'base' });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [columns, data, serverSorted, sort]);
  const showSkeleton = !mounted || Boolean(isLoading);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const useVirtual = !showSkeleton && sortedData.length >= virtualizeThreshold;

  const virtualizer = useVirtualizer({
    count: sortedData.length,
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
        {columns.map((col) => {
          const sortable = columnSortable(col);
          const active = sort?.id === col.id;
          return (
          <th
            key={col.id}
            aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={cn(
              'px-3 text-xs font-semibold tracking-wider whitespace-nowrap border-e border-white/20 last:border-e-0',
              col.align === 'end' && 'text-left',
              col.align === 'center' && 'text-center',
              col.align !== 'end' && col.align !== 'center' && 'text-right',
              col.numeric && 'min-w-[100px] tabular-nums',
              sortable && 'cursor-pointer select-none hover:bg-white/10',
              col.headerClassName
            )}
            onClick={
              sortable
                ? () =>
                    changeSort(
                      sort?.id === col.id
                        ? { id: col.id, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
                        : { id: col.id, dir: 'asc' }
                    )
                : undefined
            }
          >
            <span className="inline-flex items-center gap-1">
              {col.header}
              {sortable ? (
                <span className={cn('text-[10px]', active ? 'text-white' : 'text-white/50')}>
                  {active ? (sort?.dir === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              ) : null}
            </span>
          </th>
          );
        })}
      </tr>
    </thead>
  );

  let body: React.ReactNode;
  if (sortedData.length === 0) {
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
          const row = sortedData[vRow.index];
          return (
            <tr
              key={getRowKey(row, vRow.index)}
              tabIndex={0}
              className={cn(
                'table w-full table-fixed absolute inset-inline-start-0 h-10 border-b border-[#E8F1F6] hover:bg-[#E8F4FA] transition-colors',
                vRow.index % 2 === 1 && 'bg-[#F3F9FC]',
                onRowClick && 'cursor-pointer',
                rowClassName?.(row)
              )}
              style={{ top: vRow.start }}
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
        {sortedData.map((row, rowIndex) => (
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
    <div className={cn('col-span-full flex min-w-0 w-full max-w-full flex-col gap-3', className)} dir="rtl">
      {exportFileName && resolvedExportColumns?.length ? (
        <div className="flex justify-end">
          <TableExportActions
            fileName={exportFileName}
            columns={resolvedExportColumns}
            data={sortedData}
          />
        </div>
      ) : null}
      <div
        ref={useVirtual ? parentRef : undefined}
        className={cn(
          'erp-scroll-x min-w-0 w-full max-w-full overflow-x-scroll rounded-lg border border-[#D6EAF3] bg-white',
          useVirtual && 'max-h-[480px] overflow-y-auto'
        )}
      >
        <table className="w-max min-w-full border-collapse text-sm">
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
