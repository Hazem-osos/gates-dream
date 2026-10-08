'use client';

import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { ColumnResizeHandle } from '@/components/grid/ColumnResizeHandle';
import { ResizableColGroup } from '@/components/grid/ResizableColGroup';
import { useResizableColumns } from '@/components/grid/useResizableColumns';
import {
  dataEntryGridAddButtonClass,
  dataEntryGridBodyCellClass,
  dataEntryGridHeadCellClass,
  dataEntryGridHeadRowClass,
  dataEntryGridWrapClass,
} from './tokens';

export type DataEntryGridColumn = {
  id: string;
  label: string;
  className?: string;
  align?: 'right' | 'center' | 'left';
};

type Props = {
  columns: DataEntryGridColumn[];
  rowCount: number;
  renderCell: (rowIndex: number, columnId: string) => ReactNode;
  onAddRow?: () => void;
  addLabel?: string;
  disabled?: boolean;
  emptyMessage?: string;
  /** Key to remember column widths (defaults to column ids). */
  tableKey?: string;
  resizableColumns?: boolean;
};

export function UniversalDataGrid({
  columns,
  rowCount,
  renderCell,
  onAddRow,
  addLabel = 'إضافة سطر جديد (Enter)',
  disabled,
  emptyMessage = 'لا توجد سطور',
  tableKey,
  resizableColumns = true,
}: Props) {
  const rows = Math.max(rowCount, 0);
  const columnIds = columns.map((col) => col.id);
  const storageKey = `gates-cols:data-grid:${tableKey ?? columnIds.join('|')}`;
  const { startResize, colGroup } = useResizableColumns(columnIds, {
    storageKey,
    enabled: resizableColumns,
    defaultWidth: 140,
  });

  return (
    <div className="col-span-full min-w-0 w-full max-w-full space-y-1" dir="rtl">
      <div className={dataEntryGridWrapClass}>
        <div className="erp-scroll-x min-w-0 w-full max-w-full overflow-x-scroll">
          <table className={`min-w-full text-sm ${colGroup ? 'w-full table-fixed' : 'w-max'}`}>
            <ResizableColGroup columns={colGroup} />
            <thead>
              <tr className={dataEntryGridHeadRowClass}>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={`relative ${dataEntryGridHeadCellClass} ${
                      col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                    } ${col.className ?? ''}`}
                  >
                    {col.label}
                    {resizableColumns ? (
                      <ColumnResizeHandle onMouseDown={(event) => startResize(col.id, event)} />
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className={`${dataEntryGridBodyCellClass} py-6 text-center text-muted-foreground`}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                Array.from({ length: rows }, (_, index) => (
                  <tr key={index} className="group/row hover:bg-muted/20">
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={`${dataEntryGridBodyCellClass} ${col.className ?? ''}`}
                      >
                        {renderCell(index, col.id)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {onAddRow && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={dataEntryGridAddButtonClass}
          onClick={onAddRow}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{addLabel}</span>
        </Button>
      ) : null}
    </div>
  );
}
