'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { readImageFileAsDataUrl } from '@/lib/images/read-image-file';
import { Trash2 } from 'lucide-react';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import {
  commercialLineNet,
  commercialLineParts,
  emptyCommercialLine,
  type CommercialDocumentLine,
} from '@/components/inventory/commercial/commercial-line-types';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { InvoiceLineStockBalanceCell } from '@/components/invoices/InvoiceLineStockBalanceCell';

type Props = {
  lines: CommercialDocumentLine[];
  onChange: (lines: CommercialDocumentLine[]) => void;
  disabled?: boolean;
  warehouseId?: string;
  onImageError?: (message: string) => void;
  /** Manufacturing sales order: items + qty + specs only (no pricing / tax grid). */
  mode?: 'full' | 'manufacturing';
};

function formatMoney(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SalesOrderLinesTable({
  lines,
  onChange,
  disabled,
  warehouseId,
  onImageError,
  mode = 'full',
}: Props) {
  const manufacturingMode = mode === 'manufacturing';
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRowRef = useRef(0);
  const [imageBusy, setImageBusy] = useState(false);

  const updateLine = (index: number, patch: Partial<CommercialDocumentLine>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addRow = () => onChange([...lines, emptyCommercialLine()]);

  const removeRow = (index: number) => {
    if (lines.length <= 1) {
      onChange([emptyCommercialLine()]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  };

  const pickImage = (index: number) => {
    imageRowRef.current = index;
    fileRef.current?.click();
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || imageBusy) return;
    const index = imageRowRef.current;
    setImageBusy(true);
    void readImageFileAsDataUrl(file)
      .then((dataUrl) => updateLine(index, { imageUrl: dataUrl }))
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'تعذر رفع الصورة — استخدم صورة أصغر (JPG/PNG)';
        onImageError?.(message);
      })
      .finally(() => setImageBusy(false));
  };

  return (
    <div>
      {!warehouseId ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          اختر <strong>المخزن</strong> من بيانات الأمر أولاً لعرض أرصدة الأصناف عند اختيار البنود.
        </p>
      ) : null}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      <UniversalDataGrid
        columns={
          manufacturingMode
            ? [
                { id: 'idx', label: 'م', className: 'w-10 text-center', align: 'center' },
                { id: 'itemName', label: 'الصنف', className: 'min-w-[200px]' },
                { id: 'available', label: 'المتاح', className: 'w-24', align: 'center' },
                { id: 'quantity', label: 'الكمية المطلوبة', className: 'w-28', align: 'left' },
                { id: 'specs', label: 'مواصفات الصنف', className: 'min-w-[160px]' },
                { id: 'image', label: 'صورة الصنف', className: 'w-28', align: 'center' },
                { id: 'action', label: '', className: 'w-10', align: 'center' },
              ]
            : [
                { id: 'idx', label: 'م', className: 'w-10 text-center', align: 'center' },
                { id: 'itemName', label: 'الصنف', className: 'min-w-[200px]' },
                { id: 'quantity', label: 'الكمية', className: 'w-24', align: 'left' },
                { id: 'unitPrice', label: 'السعر', className: 'w-28', align: 'left' },
                { id: 'discount', label: 'الخصم %', className: 'w-20', align: 'left' },
                { id: 'taxRate', label: 'الضريبة %', className: 'w-20', align: 'left' },
                { id: 'net', label: 'الإجمالي', className: 'w-28', align: 'left' },
                { id: 'image', label: 'صورة الصنف', className: 'w-28', align: 'center' },
                { id: 'specs', label: 'مواصفات الصنف', className: 'min-w-[160px]' },
                { id: 'action', label: '', className: 'w-10', align: 'center' },
              ]
        }
        rowCount={Math.max(lines.length, 1)}
        onAddRow={disabled ? undefined : addRow}
        addLabel="إضافة سطر"
        disabled={disabled}
        renderCell={(index, columnId) => {
          const line = lines[index] ?? emptyCommercialLine();

          if (columnId === 'idx') {
            return <span className="block text-center font-mono text-xs text-muted-foreground">{index + 1}</span>;
          }
          if (columnId === 'itemName') {
            return (
              <ItemSelect
                value={line.itemId}
                disabled={disabled}
                emptyLabel="اختر الصنف"
                className={dataEntryGridInputClass}
                warehouseId={warehouseId}
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
              />
            );
          }
          if (columnId === 'available') {
            return warehouseId && line.itemId ? (
              <InvoiceLineStockBalanceCell itemId={line.itemId} warehouseId={warehouseId} />
            ) : (
              <span className="block text-center text-xs text-slate-400">—</span>
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
              <TableNumberInput
                disabled={disabled}
                className={`${dataEntryGridInputClass} text-end font-mono`}
                value={value}
                onValueCommit={(n) => updateLine(index, { [columnId]: n })}
              />
            );
          }
          if (columnId === 'net') {
            return (
              <span className="block px-2 text-end font-mono text-xs font-semibold">
                {formatMoney(commercialLineNet(line))}
              </span>
            );
          }
          if (columnId === 'image') {
            return (
              <div className="flex flex-col items-center gap-1">
                {line.imageUrl ? (
                  <img src={line.imageUrl} alt="" className="h-10 w-10 rounded border object-cover" />
                ) : null}
                <button
                  type="button"
                  disabled={disabled}
                  className="text-xs text-[#0E78AA] underline"
                  onClick={() => pickImage(index)}
                >
                  {imageBusy ? '…' : line.imageUrl ? 'تغيير' : 'رفع'}
                </button>
              </div>
            );
          }
          if (columnId === 'specs') {
            return (
              <input
                className={dataEntryGridInputClass}
                disabled={disabled}
                value={line.specifications ?? ''}
                placeholder="مواصفات…"
                onChange={(e) => updateLine(index, { specifications: e.target.value })}
              />
            );
          }
          return (
            <button
              type="button"
              disabled={disabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => removeRow(index)}
              aria-label="حذف"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          );
        }}
      />
      {!manufacturingMode ? (
        <p className="mt-2 text-xs text-muted-foreground">
          الإجمالي قبل الضريبة:{' '}
          <span className="font-mono font-semibold">
            {formatMoney(lines.reduce((s, l) => s + commercialLineParts(l).gross, 0))}
          </span>
        </p>
      ) : null}
    </div>
  );
}
