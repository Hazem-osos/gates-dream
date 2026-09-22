'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { Button } from '@/components/ui';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import {
  ASSEMBLY_LINE_FIELD_ORDER,
  handleLineGridKeyDown,
  lineGridDataAttrs,
} from '@/lib/keyboard/gridLineFocus';
import { useClipboardTablePaste } from '@/lib/hooks/useClipboardTablePaste';
import { mapClipboardFromField } from '@/lib/clipboard-table-parser';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { apiClient } from '@/lib/api/client';
import {
  assemblyLineTotal,
  emptyAssemblyComponentLine,
  type AssemblyComponentLine,
} from './assembly-line-types';
import { seedLineDescription, useFollowHeaderDescription } from '@/lib/hooks/useFollowHeaderDescription';

type Props = {
  lines: AssemblyComponentLine[];
  onChange: (lines: AssemblyComponentLine[]) => void;
  warehouseId?: string;
  disabled?: boolean;
  headerDescription?: string;
};

function formatMoney(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AssemblyLinesTable({
  lines,
  onChange,
  warehouseId,
  disabled,
  headerDescription = '',
}: Props) {
  const gridId = 'assembly-components';
  const wrapRef = useRef<HTMLDivElement>(null);
  const pasteFieldRef = useRef('quantity');
  const pasteIndexRef = useRef(0);

  useFollowHeaderDescription({
    headerDescription,
    lines,
    onChange,
    getDescription: (line) => line.notes,
    setDescription: (line, value) => ({ ...line, notes: value }),
    disabled,
  });

  const updateLine = (index: number, patch: Partial<AssemblyComponentLine>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addRow = () =>
    onChange([...lines, { ...emptyAssemblyComponentLine(), notes: seedLineDescription(headerDescription) }]);

  const removeRow = (index: number) => {
    if (lines.length <= 1) {
      onChange([emptyAssemblyComponentLine()]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  };

  useClipboardTablePaste(wrapRef, {
    enabled: !disabled,
    onPaste: (text) => {
      const mapped = mapClipboardFromField(text, pasteFieldRef.current);
      if (!mapped.length) return;
      const start = pasteIndexRef.current;
      const next = [...lines];
      mapped.forEach((row, offset) => {
        const index = start + offset;
        while (next.length <= index) next.push(emptyAssemblyComponentLine());
        const current = { ...next[index] };
        if (row.itemCode) current.itemCode = row.itemCode;
        if (row.itemName) current.itemName = row.itemName;
        const qty = Number(String(row.quantity ?? '').replace(/,/g, ''));
        if (Number.isFinite(qty) && row.quantity) current.quantity = qty;
        const cost = Number(String(row.unitCost ?? '').replace(/,/g, ''));
        if (Number.isFinite(cost) && row.unitCost) current.unitCost = cost;
        next[index] = current;
      });
      onChange(next);
    },
  });

  const onCellKeyDown = (e: KeyboardEvent<HTMLElement>, index: number) => {
    handleLineGridKeyDown(e, {
      gridId,
      lineIndex: index,
      fieldOrder: ASSEMBLY_LINE_FIELD_ORDER,
      onAppendLine: addRow,
      onRemoveLine: removeRow,
    });
  };

  return (
    <div
      ref={wrapRef}
      onFocusCapture={(e) => {
        const target = e.target as HTMLElement;
        const field = target.getAttribute('data-line-field');
        const index = target.getAttribute('data-line-index');
        if (field) pasteFieldRef.current = field;
        if (index != null) pasteIndexRef.current = Number(index) || 0;
      }}
    >
      <UniversalDataGrid
        columns={[
          { id: 'idx', label: '#', className: 'w-10 text-center', align: 'center' },
          { id: 'itemCode', label: 'كود الصنف / الباركود', className: 'w-28' },
          { id: 'itemName', label: 'صنف المكون (المادة الخام)', className: 'min-w-[220px]' },
          { id: 'notes', label: 'البيان', className: 'min-w-[140px]' },
          { id: 'unitName', label: 'الوحدة', className: 'w-24', align: 'center' },
          { id: 'available', label: 'الكمية الموجودة', className: 'w-28', align: 'center' },
          { id: 'quantity', label: 'الكمية المطلوبة', className: 'w-28', align: 'left' },
          { id: 'unitCost', label: 'تكلفة الوحدة', className: 'w-28', align: 'left' },
          { id: 'total', label: 'إجمالي التكلفة', className: 'w-28', align: 'left' },
          { id: 'action', label: 'إجراء', className: 'w-12', align: 'center' },
        ]}
        rowCount={Math.max(lines.length, 1)}
        onAddRow={disabled ? undefined : addRow}
        addLabel="إضافة مكون يدوي (Enter)"
        disabled={disabled}
        renderCell={(index, columnId) => {
          const line = lines[index] ?? emptyAssemblyComponentLine();
          const attrs = (field: string) => lineGridDataAttrs(gridId, index, field);

          if (columnId === 'idx') {
            return (
              <span className="block text-center font-mono text-xs text-muted-foreground">
                {index + 1}
              </span>
            );
          }
          if (columnId === 'itemCode') {
            return (
              <input
                className={`${dataEntryGridInputClass} font-mono`}
                disabled={disabled}
                value={line.itemCode}
                onChange={(e) => updateLine(index, { itemCode: e.target.value })}
                onKeyDown={(e) => onCellKeyDown(e, index)}
                {...attrs('itemCode')}
              />
            );
          }
          if (columnId === 'itemName') {
            return (
              <ItemSelect
                value={line.itemId}
                disabled={disabled}
                emptyLabel="اختر المكون"
                className={dataEntryGridInputClass}
                onChange={(id) => updateLine(index, { itemId: id })}
                onItemResolved={(item) => {
                  if (!item || !('units' in item)) return;
                  const catalog = item as ItemOption;
                  const unit = catalog.units?.find((u) => u.isBaseUnit) ?? catalog.units?.[0];
                  const patch: Partial<AssemblyComponentLine> = {
                    itemId: item.id,
                    itemCode: catalog.code || item.serial || line.itemCode,
                    itemName: item.arabicName,
                    unitId: unit?.unitId || unit?.unit?.id || '',
                    unitName: unit?.unit?.arabicName || '',
                    unitCost: line.unitCost || Number(catalog.averageCost) || 0,
                    availableQuantity: Number(catalog.onHandQuantity) || 0,
                  };
                  updateLine(index, patch);
                  if (warehouseId) {
                    void apiClient
                      .get<Array<{ quantity?: number | string }>>(
                        `/inventory/item-quantities/item/${item.id}`,
                        { warehouseId }
                      )
                      .then((res) => {
                        const available = (res.data ?? []).reduce(
                          (sum, row) => sum + (Number(row.quantity) || 0),
                          0
                        );
                        updateLine(index, { availableQuantity: available });
                      })
                      .catch(() => undefined);
                  }
                }}
                onInputKeyDown={(e) => onCellKeyDown(e, index)}
                inputProps={attrs('itemName')}
                menuPlacement="auto"
              />
            );
          }
          if (columnId === 'unitName') {
            return (
              <span className="block rounded-md bg-muted/50 px-2 py-1.5 text-center text-xs text-muted-foreground">
                {line.unitName || '—'}
              </span>
            );
          }
          if (columnId === 'available') {
            return (
              <span className="block rounded bg-muted/30 py-1 text-center font-mono text-xs text-muted-foreground">
                {formatMoney(line.availableQuantity)}
              </span>
            );
          }
          if (columnId === 'quantity' || columnId === 'unitCost') {
            const value = columnId === 'quantity' ? line.quantity : line.unitCost;
            return (
              <TableNumberInput
                disabled={disabled}
                className={`${dataEntryGridInputClass} text-end font-mono font-bold`}
                value={value}
                onValueCommit={(n) => updateLine(index, { [columnId]: n })}
                onKeyDown={(e) => onCellKeyDown(e, index)}
                {...attrs(columnId)}
              />
            );
          }
          if (columnId === 'total') {
            return (
              <span className="block px-2 text-end font-mono text-xs font-semibold text-muted-foreground">
                {formatMoney(assemblyLineTotal(line))}
              </span>
            );
          }
          if (columnId === 'notes') {
            return (
              <input
                className={dataEntryGridInputClass}
                disabled={disabled}
                value={line.notes}
                onChange={(e) => updateLine(index, { notes: e.target.value })}
                onKeyDown={(e) => onCellKeyDown(e, index)}
                {...attrs('notes')}
              />
            );
          }
          return (
            <button
              type="button"
              disabled={disabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => removeRow(index)}
              aria-label="حذف المكون"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          );
        }}
      />
      {!disabled ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2 gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
          onClick={addRow}
        >
          <Plus className="h-3.5 w-3.5" />
          إضافة مكون يدوي (Enter)
        </Button>
      ) : null}
    </div>
  );
}
