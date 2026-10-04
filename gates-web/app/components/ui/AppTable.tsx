'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './TableSkeleton';
import { TablePagination, type TablePaginationProps } from './TablePagination';
import { TableExportActions } from './TableExportActions';
import { ColumnValueMenu } from '@/components/grid/ColumnValueMenu';
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

export interface AppTableProps<T extends object> {
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
    const locale = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en-GB' : 'ar-EG';
    return value.toLocaleString(locale, {
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

function columnSortable<T extends object>(col: AppTableColumn<T>): boolean {
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

function inferredFieldValue<T extends object>(row: T, colId: string): unknown {
  const record = row as Record<string, unknown>;
  if (record[colId] != null && record[colId] !== '') return record[colId];
  if (/num|serial|code|number/.test(colId)) {
    return (
      record.voucherNumber ??
      record.legacyGlNum ??
      record.serialNumber ??
      record.serial ??
      record.code ??
      record.invoiceNumber ??
      record.documentNumber ??
      record.entryNumber ??
      ''
    );
  }
  if (/date/.test(colId)) {
    return record.date ?? record.createdAt ?? record.openingDate ?? '';
  }
  return record[colId];
}

function columnFilterText<T extends object>(row: T, col: AppTableColumn<T>): string {
  if (col.sortValue) {
    const value = col.sortValue(row);
    if (value == null || value === '') return '';
    return String(value).trim();
  }
  if (col.accessor) {
    const value = (row as Record<string, unknown>)[String(col.accessor)];
    if (value == null || value === '') return '';
    if (typeof value === 'object') return '';
    return String(formatCellValue(value, col.numeric)).trim();
  }
  const inferred = inferredFieldValue(row, col.id);
  if (inferred == null || inferred === '' || typeof inferred === 'object') return '';
  return String(inferred).trim();
}

function columnSortValue<T extends object>(
  row: T,
  col: AppTableColumn<T>
): string | number {
  if (col.sortValue) return parseSortable(col.sortValue(row));
  if (col.accessor) return parseSortable((row as Record<string, unknown>)[String(col.accessor)]);
  return parseSortable(inferredFieldValue(row, col.id));
}

export function AppTable<T extends object>({
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
  const [valueFilters, setValueFilters] = React.useState<Record<string, string[]>>({});
  const [openHeader, setOpenHeader] = React.useState<string | null>(null);
  const [headerAnchor, setHeaderAnchor] = React.useState<{ top: number; right: number } | null>(null);
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
  const valuesByColumn = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const col of columns) {
      if (/^(actions|action|ops|open)$/.test(col.id)) {
        map.set(col.id, []);
        continue;
      }
      const values = new Set<string>();
      for (const row of data) {
        const text = columnFilterText(row, col);
        if (text && text !== '—') values.add(text);
      }
      map.set(col.id, [...values].sort((a, b) => a.localeCompare(b, 'ar')));
    }
    return map;
  }, [columns, data]);
  const filteredData = React.useMemo(() => {
    const active = Object.entries(valueFilters).filter(([, selected]) => selected.length > 0);
    if (!active.length) return sortedData;
    return sortedData.filter((row) =>
      active.every(([id, selected]) => {
        const col = columns.find((item) => item.id === id);
        if (!col) return true;
        return selected.includes(columnFilterText(row, col));
      })
    );
  }, [columns, sortedData, valueFilters]);
  const showSkeleton = !mounted || Boolean(isLoading);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const useVirtual = !showSkeleton && filteredData.length >= virtualizeThreshold;

  const virtualizer = useVirtualizer({
    count: filteredData.length,
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
        content = formatCellValue((row as Record<string, unknown>)[String(col.accessor)], col.numeric);
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
          const columnValues = valuesByColumn.get(col.id) ?? [];
          const filtering = (valueFilters[col.id]?.length ?? 0) > 0;
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
              (columnValues.length > 0 || sortable) && 'cursor-pointer select-none hover:bg-white/10',
              col.headerClassName
            )}
            onMouseDown={columnValues.length ? (event) => event.stopPropagation() : undefined}
            onClick={
              columnValues.length
                ? (event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setHeaderAnchor({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
                    setOpenHeader((current) => (current === col.id ? null : col.id));
                  }
                : sortable
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
              {active ? (
                <span className="text-[10px] text-amber-200">{sort?.dir === 'asc' ? '↑' : '↓'}</span>
              ) : sortable && !columnValues.length ? (
                <span className="text-[10px] text-white/50">↕</span>
              ) : null}
              {columnValues.length ? (
                <span className={cn('text-[10px]', filtering ? 'text-amber-200' : 'text-white/70')}>▾</span>
              ) : null}
            </span>
          </th>
          );
        })}
      </tr>
    </thead>
  );

  let body: React.ReactNode;
  if (filteredData.length === 0) {
    const filtering = Object.values(valueFilters).some((selected) => selected.length > 0);
    body = (
      <tbody>
        <tr>
          <td colSpan={columns.length}>
            <EmptyState
              title={filtering ? 'لا توجد صفوف' : emptyTitle}
              description={filtering ? 'لا توجد صفوف تطابق القيم المختارة من عنوان العمود.' : emptyDescription}
            />
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
          const row = filteredData[vRow.index];
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
        {filteredData.map((row, rowIndex) => (
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
            data={filteredData}
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
        {openHeader && headerAnchor && (valuesByColumn.get(openHeader)?.length ?? 0) > 0 ? (
          <ColumnValueMenu
            label={(() => {
              const header = columns.find((col) => col.id === openHeader)?.header;
              return typeof header === 'string' ? header : '';
            })()}
            values={valuesByColumn.get(openHeader) ?? []}
            selected={valueFilters[openHeader] ?? []}
            sortDirection={sort?.id === openHeader ? sort.dir : null}
            anchor={headerAnchor}
            onClose={() => setOpenHeader(null)}
            onSort={(direction) => {
              if (!direction) {
                setSort(null);
                return;
              }
              changeSort({ id: openHeader, dir: direction });
            }}
            onSelected={(selected) =>
              setValueFilters((prev) => {
                const next = { ...prev };
                if (!selected.length) delete next[openHeader];
                else next[openHeader] = selected;
                return next;
              })
            }
            onClear={() => {
              setValueFilters((prev) => {
                const next = { ...prev };
                delete next[openHeader];
                return next;
              });
              setOpenHeader(null);
            }}
          />
        ) : null}
      </div>
      {pagination ? <TablePagination {...pagination} /> : null}
    </div>
  );
}

/** Alias for design-system docs */
export const DataTable = AppTable;
