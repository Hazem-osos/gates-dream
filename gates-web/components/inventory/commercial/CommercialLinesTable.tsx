'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import {
  COMMERCIAL_LINE_FIELD_ORDER,
  handleLineGridKeyDown,
  lineGridDataAttrs,
} from '@/lib/keyboard/gridLineFocus';
import { useClipboardTablePaste } from '@/lib/hooks/useClipboardTablePaste';
import { mapClipboardFromField } from '@/lib/clipboard-table-parser';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import {
  commercialLineNet,
  emptyCommercialLine,
  type CommercialDocumentLine,
} from './commercial-line-types';
import { seedLineDescription, useFollowHeaderDescription } from '@/lib/hooks/useFollowHeaderDescription';

type Props = {
  lines: CommercialDocumentLine[];
  onChange: (lines: CommercialDocumentLine[]) => void;
  disabled?: boolean;
  headerDescription?: string;
};

function parseNum(raw: string) {
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CommercialLinesTable({ lines, onChange, disabled, headerDescription = '' }: Props) {
  const gridId = 'commercial-doc-lines';
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

  const updateLine = (index: number, patch: Partial<CommercialDocumentLine>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addRow = () =>
    onChange([...lines, { ...emptyCommercialLine(), notes: seedLineDescription(headerDescription) }]);

  const removeRow = (index: number) => {
    if (lines.length <= 1) {
      onChange([emptyCommercialLine()]);
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
        while (next.length <= index) next.push(emptyCommercialLine());
        const current = { ...next[index] };
        if (row.itemCode) current.itemCode = row.itemCode;
        if (row.itemName) current.itemName = row.itemName;
        const qty = Number(String(row.quantity ?? '').replace(/,/g, ''));
        if (Number.isFinite(qty) && row.quantity) current.quantity = qty;
        const price = Number(String(row.unitCost ?? '').replace(/,/g, ''));
        if (Number.isFinite(price) && row.unitCost) current.unitPrice = price;
        next[index] = current;
      });
      onChange(next);
    },
  });

  const onCellKeyDown = (e: KeyboardEvent<HTMLElement>, index: number) => {
    handleLineGridKeyDown(e, {
      gridId,
      lineIndex: index,
      fieldOrder: COMMERCIAL_LINE_FIELD_ORDER,
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
          { id: 'itemCode', label: 'كود الصنف', className: 'w-28' },
          { id: 'itemName', label: 'اسم الصنف', className: 'min-w-[220px]' },
          { id: 'notes', label: 'البيان', className: 'min-w-[140px]' },
          { id: 'unitName', label: 'الوحدة', className: 'w-20' },
          { id: 'quantity', label: 'الكمية', className: 'w-24', align: 'left' },
          { id: 'unitPrice', label: 'سعر الوحدة', className: 'w-28', align: 'left' },
          { id: 'discount', label: 'الخصم (%)', className: 'w-20', align: 'left' },
          { id: 'taxRate', label: 'الضريبة (VAT 14%)', className: 'w-24', align: 'left' },
          { id: 'net', label: 'الإجمالي الصافي', className: 'w-28', align: 'left' },
          { id: 'costCenter', label: 'مركز التكلفة', className: 'min-w-[160px]' },
          { id: 'action', label: 'إجراء', className: 'w-12', align: 'center' },
        ]}
        rowCount={Math.max(lines.length, 1)}
        onAddRow={disabled ? undefined : addRow}
        addLabel="إضافة صنف جديد (Enter)"
        disabled={disabled}
        renderCell={(index, columnId) => {
          const line = lines[index] ?? emptyCommercialLine();
          const attrs = (field: string) => lineGridDataAttrs(gridId, index, field);

          if (columnId === 'idx') {
            return <span className="block text-center font-mono text-xs text-muted-foreground">{index + 1}</span>;
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
                emptyLabel="اختر الصنف"
                className={dataEntryGridInputClass}
                onChange={(id) => updateLine(index, { itemId: id })}
                onItemResolved={(item) => {
                  if (!item || !('units' in item)) return;
                  const catalog = item as ItemOption;
                  const unit = catalog.units?.find((u) => u.isBaseUnit) ?? catalog.units?.[0];
                  updateLine(index, {
                    itemId: item.id,
                    itemCode: catalog.code || item.serial || line.itemCode,
                    itemName: item.arabicName,
                    unitId: unit?.unitId || unit?.unit?.id || '',
                    unitName: unit?.unit?.arabicName || '',
                    unitPrice: line.unitPrice || Number(catalog.salesPrice || catalog.averageCost) || 0,
                  });
                }}
                onInputKeyDown={(e) => onCellKeyDown(e, index)}
                inputProps={attrs('itemName')}
                menuPlacement="auto"
              />
            );
          }
          if (columnId === 'unitName') {
            return (
              <span className="block rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                {line.unitName || '—'}
              </span>
            );
          }
          if (columnId === 'quantity' || columnId === 'unitPrice' || columnId === 'discount' || columnId === 'taxRate') {
            const value =
              columnId === 'quantity'
                ? line.quantity
                : columnId === 'unitPrice'
                  ? line.unitPrice
                  : columnId === 'discount'
                    ? line.discount
                    : line.taxRate;
            return (
              <input
                inputMode="decimal"
                disabled={disabled}
                className={`${dataEntryGridInputClass} text-end font-mono`}
                value={value ? String(value) : ''}
                onChange={(e) => updateLine(index, { [columnId]: parseNum(e.target.value) })}
                onKeyDown={(e) => onCellKeyDown(e, index)}
                {...attrs(columnId)}
              />
            );
          }
          if (columnId === 'net') {
            return (
              <span className="block px-2 text-end font-mono text-xs font-semibold text-muted-foreground">
                {formatMoney(commercialLineNet(line))}
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
          if (columnId === 'costCenter') {
            return (
              <CostCenterSelect
                value={line.costCenterId}
                disabled={disabled}
                emptyLabel="مركز التكلفة"
                className={dataEntryGridInputClass}
                onChange={(id) => updateLine(index, { costCenterId: id })}
                nativeSelectProps={{
                  ...attrs('costCenter'),
                  onKeyDown: (e) => onCellKeyDown(e, index),
                }}
              />
            );
          }
          return (
            <button
              type="button"
              disabled={disabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => removeRow(index)}
              aria-label="حذف السطر"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          );
        }}
      />
    </div>
  );
}
