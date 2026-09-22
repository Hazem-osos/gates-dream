'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import {
  handleLineGridKeyDown,
  lineGridDataAttrs,
  OPENING_STOCK_LINE_FIELD_ORDER,
} from '@/lib/keyboard/gridLineFocus';
import { useClipboardTablePaste } from '@/lib/hooks/useClipboardTablePaste';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import {
  emptyOpeningStockLine,
  formatMoney,
  lineValue,
  openingStockLineIssues,
  type OpeningStockLineForm,
} from './opening-stock-types';

type Props = {
  lines: OpeningStockLineForm[];
  onChange: (lines: OpeningStockLineForm[]) => void;
  onAddRow: () => void;
  onPasteText: (text: string, startField?: string, startIndex?: number) => void;
  disabled?: boolean;
  defaultWarehouseId?: string;
  onItemResolved?: (index: number, item: ItemOption | undefined) => void;
  onResolveItemCode?: (index: number, code: string) => void;
};

export function OpeningStockLinesTable({
  lines,
  onChange,
  onAddRow,
  onPasteText,
  disabled,
  defaultWarehouseId,
  onItemResolved,
  onResolveItemCode,
}: Props) {
  const gridId = 'opening-stock-lines';
  const wrapRef = useRef<HTMLDivElement>(null);
  const pasteFieldRef = useRef<string>('quantity');
  const pasteIndexRef = useRef(0);

  useClipboardTablePaste(wrapRef, {
    enabled: !disabled,
    onPaste: (text) => onPasteText(text, pasteFieldRef.current, pasteIndexRef.current),
  });

  const updateLine = (index: number, patch: Partial<OpeningStockLineForm>) => {
    const next = lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
    onChange(next);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      onChange([emptyOpeningStockLine(defaultWarehouseId)]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  };

  const onCellKeyDown = (e: KeyboardEvent<HTMLElement>, index: number) => {
    handleLineGridKeyDown(e, {
      gridId,
      lineIndex: index,
      fieldOrder: OPENING_STOCK_LINE_FIELD_ORDER,
      onAppendLine: onAddRow,
      onRemoveLine: removeLine,
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
          { id: 'itemCode', label: 'كود الصنف', className: 'w-28' },
          { id: 'itemName', label: 'اسم الصنف', className: 'min-w-[220px]' },
          { id: 'unitName', label: 'الوحدة', className: 'w-20' },
          { id: 'warehouseId', label: 'المخزن', className: 'min-w-[160px]' },
          { id: 'quantity', label: 'كمية أول المدة', className: 'w-28', align: 'left' },
          { id: 'unitCost', label: 'تكلفة الوحدة', className: 'w-28', align: 'left' },
          { id: 'total', label: 'إجمالي القيمة', className: 'w-28', align: 'left' },
          { id: 'batchNumber', label: 'رقم التشغيلة', className: 'w-28' },
          { id: 'expiryDate', label: 'تاريخ الصلاحية', className: 'w-36' },
          { id: 'action', label: 'إجراء', className: 'w-12', align: 'center' },
        ]}
        rowCount={Math.max(lines.length, 1)}
        onAddRow={disabled ? undefined : onAddRow}
        addLabel="إضافة صنف جديد (Enter)"
        disabled={disabled}
        emptyMessage="أضف أصنافاً أو حمّل الكتالوج أو الصق من إكسيل"
        renderCell={(index, columnId) => {
          const line = lines[index] ?? emptyOpeningStockLine(defaultWarehouseId);
          const attrs = (field: string) => lineGridDataAttrs(gridId, index, field);
          const started = Boolean(line.itemId || line.itemCode || line.itemName || Number(line.quantity) > 0);
          const issues = started ? openingStockLineIssues(line) : [];
          const issueHint = issues.length ? issues.join(' · ') : undefined;

          if (columnId === 'idx') {
            return (
              <span className="block w-10 text-center font-mono text-xs text-muted-foreground">
                {index + 1}
              </span>
            );
          }

          if (columnId === 'itemCode') {
            return (
              <input
                type="text"
                disabled={disabled}
                className={`${dataEntryGridInputClass} font-mono ${!line.itemId && started ? 'border-amber-400' : ''}`}
                value={line.itemCode}
                placeholder="الكود"
                onChange={(e) => updateLine(index, { itemCode: e.target.value })}
                onBlur={() => onResolveItemCode?.(index, line.itemCode)}
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
                emptyLabel="اختر الصنف"
                className={`${dataEntryGridInputClass} ${!line.itemId && started ? 'border-amber-400' : ''}`}
                onChange={(id) =>
                  updateLine(index, {
                    itemId: id,
                    warehouseId: line.warehouseId || defaultWarehouseId || '',
                  })
                }
                onItemResolved={(item) => {
                  if (!item) return;
                  const catalog = 'units' in item ? item : undefined;
                  const unit =
                    catalog?.units?.find((u) => u.isBaseUnit)?.unit?.arabicName ||
                    catalog?.units?.[0]?.unit?.arabicName ||
                    '';
                  updateLine(index, {
                    itemId: item.id,
                    itemCode: catalog?.code || item.serial || line.itemCode,
                    itemName: item.arabicName,
                    unitName: unit,
                    warehouseId: line.warehouseId || defaultWarehouseId || '',
                    unitCost: line.unitCost || Number(catalog?.averageCost) || 0,
                  });
                  onItemResolved?.(index, catalog);
                }}
                onInputKeyDown={(e) => onCellKeyDown(e, index)}
                inputProps={attrs('itemName')}
                menuPlacement="auto"
              />
            );
          }

          if (columnId === 'unitName') {
            return (
              <span className="block rounded-md bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {line.unitName || '—'}
              </span>
            );
          }

          if (columnId === 'warehouseId') {
            return (
              <WarehouseSelect
                value={line.warehouseId}
                disabled={disabled}
                emptyLabel="المخزن"
                className={`${dataEntryGridInputClass} ${!line.warehouseId && started ? 'border-amber-400' : ''}`}
                onChange={(id) => updateLine(index, { warehouseId: id })}
                nativeSelectProps={{
                  ...attrs('warehouseId'),
                  onKeyDown: (e) => onCellKeyDown(e, index),
                }}
              />
            );
          }

          if (columnId === 'quantity') {
            return (
              <TableNumberInput
                disabled={disabled}
                className={`${dataEntryGridInputClass} text-end font-mono font-medium ${started && !(Number(line.quantity) > 0) ? 'border-amber-400' : ''}`}
                value={line.quantity}
                placeholder="0"
                onValueCommit={(n) => updateLine(index, { quantity: n })}
                onKeyDown={(e) => onCellKeyDown(e, index)}
                {...attrs('quantity')}
              />
            );
          }

          if (columnId === 'unitCost') {
            return (
              <TableNumberInput
                disabled={disabled}
                className={`${dataEntryGridInputClass} text-end font-mono font-medium`}
                value={line.unitCost}
                placeholder="0.00"
                onValueCommit={(n) => updateLine(index, { unitCost: n })}
                onKeyDown={(e) => onCellKeyDown(e, index)}
                {...attrs('unitCost')}
              />
            );
          }

          if (columnId === 'total') {
            return (
              <div>
                <span className="block px-2 text-end font-mono text-xs font-semibold text-muted-foreground">
                  {formatMoney(lineValue(line))}
                </span>
                {issueHint ? (
                  <p className="mt-0.5 px-1 text-[10px] font-medium text-amber-700">{issueHint}</p>
                ) : null}
              </div>
            );
          }

          if (columnId === 'batchNumber') {
            return (
              <input
                type="text"
                disabled={disabled}
                className={dataEntryGridInputClass}
                value={line.batchNumber}
                placeholder="التشغيلة"
                onChange={(e) => updateLine(index, { batchNumber: e.target.value })}
                onKeyDown={(e) => onCellKeyDown(e, index)}
                {...attrs('batchNumber')}
              />
            );
          }

          if (columnId === 'expiryDate') {
            return (
              <input
                type="date"
                disabled={disabled}
                className={dataEntryGridInputClass}
                value={line.expiryDate}
                onChange={(e) => updateLine(index, { expiryDate: e.target.value })}
                onKeyDown={(e) => onCellKeyDown(e, index)}
                {...attrs('expiryDate')}
              />
            );
          }

          return (
            <button
              type="button"
              disabled={disabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="حذف السطر"
              onClick={() => removeLine(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          );
        }}
      />
    </div>
  );
}
