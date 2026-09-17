'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import dynamic from 'next/dynamic';
import { ColumnVisibilityPicker } from '@/components/inventory/ColumnVisibilityPicker';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import { AccountSelect } from '@/components/form/AccountSelect';
import { SmartBatchExpiryCell } from '@/components/invoices/SmartBatchExpiryCell';
import { LineWithholdingTaxCell } from '@/components/invoices/LineWithholdingTaxCell';
import { ApparelVariantCell } from '@/components/invoices/ApparelVariantCells';
import { InvoiceLineStockBalanceCell } from '@/components/invoices/InvoiceLineStockBalanceCell';
import { itemHasApparelVariants, itemIsBatchTracked } from '@/lib/invoices/itemTracking';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';
import { calculateRowTotals } from '@/lib/invoices/calculateInvoiceRowTotals';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import { TableColumnHeaderDropdown } from '@/components/grid/TableColumnHeaderDropdown';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { ItemSelect } from '@/components/form/ItemSelect';
import { ItemUnitSelect } from '@/components/form/ItemUnitSelect';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';

const ItemQuickAddModal = dynamic(
  () =>
    import('@/app/components/form/ItemQuickAddModal').then((m) => ({
      default: m.ItemQuickAddModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل إضافة صنف…" /> }
);

const ItemQuickPeekDrawer = dynamic(
  () =>
    import('@/components/inventory/ItemQuickPeekDrawer').then((m) => ({
      default: m.ItemQuickPeekDrawer,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل بطاقة الصنف…" /> }
);

import { useItemsQuery } from '@/lib/hooks/useMasterDataQueries';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { isPriceBelowAverageCost } from '@/lib/accounting-settings/guardrail-hints';
import { findItemByBarcode, itemBarcodeValue } from '@/lib/inventory/findItemByBarcode';
import { toast } from '@/lib/feedback/toast';
import {
  INVOICE_LINE_COLUMN_DEFS,
  type InvoiceColumnStorageKey,
  type InvoiceLineColumnId,
  buildFocusFieldOrder,
} from '@/lib/invoices/invoiceLineColumns';
import { computeLineSubtotalAfterDiscount } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { VAT_LABEL_AR, type DiscountType } from '@/lib/invoices/discount-type';
import { InvoiceLineDiscountInput } from '@/components/inventory/InvoiceLineDiscountInput';
import { baseUnitLabelForItem, baseUnitLinkForItem } from '@/lib/inventory/item-units';
import { syncLineUnitFields, type PricingCalculationBasis } from '@/lib/invoices/unit-conversion';
import type { SalesInvoiceFormValues } from '@/lib/validation/inventory.schema';
import {
  handleLineGridKeyDown,
  lineGridDataAttrs,
  focusLineField,
} from '@/lib/keyboard/gridLineFocus';
import {
  ERP_INVOICE_ITEMS_CARD_CLASS,
  ERP_INVOICE_ITEMS_TABLE_WRAP_CLASS,
  ERP_SALES_COLUMN_WIDTH,
  erpFieldErrorClass,
  erpInputErrorClass,
  erpLineGridInputClass,
  erpTableBodyCellClass,
  erpTableHeadCellClass,
  erpTableHeadRowClass,
} from '@/components/inventory/sales-invoice/erpUiTokens';
import { useClipboardTablePaste } from '@/lib/hooks/useClipboardTablePaste';
import { useFollowHeaderDescription } from '@/lib/hooks/useFollowHeaderDescription';
import {
  parseInvoiceLinesFromClipboard,
  type ClipboardItemRef,
} from '@/lib/inventory/clipboardTablePaste';

interface Item {
  id: string;
  code?: string;
  serial?: string;
  barcode?: string;
  arabicName: string;
  units?: {
    unitId?: string;
    isBaseUnit?: boolean;
    isFactorFixed?: boolean | null;
    conversionFactor?: number | string | null;
    unit?: { id: string; arabicName: string };
  }[];
  defaultTaxPercent?: number | string | null;
  taxExemptionReason?: string | null;
  salesPrice?: number | null;
  averageCost?: number | string | null;
  useExpirationDate?: boolean | null;
  useSerialNumber?: boolean | null;
  clothingItem?: boolean | null;
  trackingType?: string | null;
  hasExpiry?: boolean | null;
  color?: string | null;
  size?: string | null;
  colorId?: string | null;
}

type FieldArrayField = { id: string };

const inputClsBase =
  'w-full p-2.5 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA]/20 focus:border-[#0E78AA] focus:bg-white transition-all duration-200';
const inputErrorClass = 'border-red-400 focus:border-red-400 focus:ring-red-200';
const fieldErrorClass = 'text-red-600 text-xs mt-1 block text-right';

function FieldError({
  message,
  show,
  className,
}: {
  message?: string;
  show?: boolean;
  className?: string;
}) {
  if (!show || !message) return null;
  return <span className={className ?? fieldErrorClass}>{message}</span>;
}

type Props = {
  gridId: string;
  storageKey: InvoiceColumnStorageKey;
  control: Control<SalesInvoiceFormValues>;
  register: UseFormRegister<SalesInvoiceFormValues>;
  setValue: UseFormSetValue<SalesInvoiceFormValues>;
  errors: FieldErrors<SalesInvoiceFormValues>;
  fields: FieldArrayField[];
  linesW: SalesInvoiceFormValues['lines'] | undefined;
  itemsLoading: boolean;
  warehouseId?: string;
  visibleColumnIds: InvoiceLineColumnId[];
  onVisibleColumnIdsChange: (ids: InvoiceLineColumnId[]) => void;
  onAppendLine: () => void;
  onRemoveLine: (index: number) => void;
  applyPickedItemToLine: (index: number, picked: Item | undefined) => void;
  linesRootMessage?: string;
  modernUi?: boolean;
  showValidationErrors?: boolean;
  clipboardItems?: ClipboardItemRef[];
  onClipboardLines?: (lines: ReturnType<typeof parseInvoiceLinesFromClipboard>['lines']) => void;
  customerId?: string;
  pricingCalculationBasis?: PricingCalculationBasis | string;
  readOnly?: boolean;
  lockUnitPrice?: boolean;
  enforceBelowCost?: boolean;
  headerDescription?: string;
};

export function ProgressiveSalesInvoiceLineGrid({
  gridId,
  storageKey,
  control,
  register,
  setValue,
  errors,
  fields,
  linesW,
  itemsLoading,
  warehouseId,
  visibleColumnIds,
  onVisibleColumnIdsChange,
  onAppendLine,
  onRemoveLine,
  applyPickedItemToLine,
  linesRootMessage,
  modernUi = false,
  showValidationErrors = false,
  clipboardItems,
  onClipboardLines,
  customerId,
  pricingCalculationBasis = 'SELECTED_UNIT_QTY',
  readOnly = false,
  lockUnitPrice = false,
  enforceBelowCost = false,
  headerDescription = '',
}: Props) {
  useFollowHeaderDescription({
    headerDescription,
    lines: linesW ?? [],
    onChange: (next) => {
      next.forEach((line, index) => {
        const current = linesW?.[index]?.lineNotes ?? '';
        if ((line.lineNotes ?? '') !== current) {
          setValue(`lines.${index}.lineNotes`, line.lineNotes ?? '', {
            shouldDirty: false,
            shouldValidate: false,
          });
        }
      });
    },
    getDescription: (line) => line.lineNotes,
    setDescription: (line, value) => ({ ...line, lineNotes: value }),
    disabled: readOnly,
  });

  const [peekIndex, setPeekIndex] = useState<number | null>(null);
  const companyId = getTenantContext().companyId;
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleClipboardPaste = useCallback(
    (text: string) => {
      if (!clipboardItems?.length || !onClipboardLines) return;
      const { lines } = parseInvoiceLinesFromClipboard(text, clipboardItems);
      if (lines.length > 0) onClipboardLines(lines);
    },
    [clipboardItems, onClipboardLines]
  );

  useClipboardTablePaste(gridContainerRef, {
    enabled: Boolean(clipboardItems?.length && onClipboardLines),
    onPaste: handleClipboardPaste,
  });

  useEffect(() => {
    const root = gridContainerRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.key.toLowerCase() !== 'i') return;
      const active = document.activeElement as HTMLElement | null;
      const idxAttr =
        active?.getAttribute('data-line-index') ??
        active?.closest('[data-line-index]')?.getAttribute('data-line-index');
      if (idxAttr == null) return;
      const index = Number(idxAttr);
      if (!Number.isFinite(index)) return;
      e.preventDefault();
      setPeekIndex(index);
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, []);

  const peekLine = peekIndex != null ? linesW?.[peekIndex] : undefined;

  // Read-only "Unit Conversion" column — reuses the same items+units cache
  // ItemUnitSelect already populates, so this adds no extra network cost.
  const { data: itemsForConversionResponse } = useItemsQuery();
  const { data: accountingSettingsRes } = useAccountingSettingsQuery();
  const preventSellingBelowCost =
    enforceBelowCost || accountingSettingsRes?.data?.controls?.noSellBelowCost === true;
  const itemsForConversion = useMemo(
    () => itemsForConversionResponse?.data ?? [],
    [itemsForConversionResponse?.data]
  );
  const conversionFactorFor = useCallback(
    (itemId?: string, unitId?: string): number | null => {
      if (!itemId || !unitId) return null;
      const item = itemsForConversion.find((i) => i.id === itemId);
      const link = item?.units?.find((u) => (u.unit?.id ?? u.unitId) === unitId);
      return link?.conversionFactor != null ? Number(link.conversionFactor) : null;
    },
    [itemsForConversion]
  );

  const syncLineUnits = useCallback(
    (index: number, patch: { quantity?: number; unitId?: string; baseQuantity?: number }) => {
      const current = linesW?.[index];
      const item = itemsForConversion.find((i) => i.id === (current?.itemId ?? ''));
      const synced = syncLineUnitFields(
        {
          quantity: Number(current?.quantity) || 1,
          baseQuantity: Number(current?.baseQuantity),
          conversionFactor: Number(current?.conversionFactor),
          unitId: current?.unitId,
          baseUnitId: current?.baseUnitId,
        },
        item?.units,
        patch
      );
      setValue(`lines.${index}.quantity`, synced.quantity, { shouldDirty: true });
      setValue(`lines.${index}.baseQuantity`, synced.baseQuantity, { shouldDirty: true });
      setValue(`lines.${index}.conversionFactor`, synced.conversionFactor, { shouldDirty: true });
      setValue(`lines.${index}.baseUnitId`, synced.baseUnitId, { shouldDirty: true });
    },
    [itemsForConversion, linesW, setValue]
  );

  const lineGridScrollRef = useRef<HTMLDivElement>(null);
  const virtualizeLines = fields.length >= 40;
  const lineVirtualizer = useVirtualizer({
    count: fields.length,
    getScrollElement: () => lineGridScrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
    enabled: virtualizeLines,
  });
  const visibleLineIndexes = virtualizeLines
    ? lineVirtualizer.getVirtualItems().map((v) => v.index)
    : fields.map((_, i) => i);
  const firstVirtual = virtualizeLines ? lineVirtualizer.getVirtualItems()[0] : undefined;
  const lastVirtual = virtualizeLines ? lineVirtualizer.getVirtualItems().at(-1) : undefined;
  const topSpacer = firstVirtual?.start ?? 0;
  const bottomSpacer =
    virtualizeLines && lastVirtual
      ? Math.max(0, lineVirtualizer.getTotalSize() - lastVirtual.end)
      : 0;

  const lineInputCls = modernUi ? erpLineGridInputClass : inputClsBase;
  const lineInputErr = (has?: boolean) =>
    showValidationErrors && has ? (modernUi ? erpInputErrorClass : inputErrorClass) : '';
  const tdBase = (colId: InvoiceLineColumnId, extra = '') =>
    [
      modernUi ? erpTableBodyCellClass : 'py-2 px-2 border-x border-[#D6EAF3] align-top',
      ERP_SALES_COLUMN_WIDTH[colId] ?? '',
      extra,
    ]
      .filter(Boolean)
      .join(' ');
  const thClass = modernUi ? erpTableHeadCellClass : 'py-3 px-2 font-bold whitespace-nowrap';
  const theadRowClass = modernUi
    ? erpTableHeadRowClass
    : 'bg-[#0E78AA] text-white text-sm';
  const fieldErrShow = showValidationErrors;
  const fieldErrClass = modernUi ? erpFieldErrorClass : fieldErrorClass;

  const effectiveColumnIds = useMemo(() => {
    const next = new Set(visibleColumnIds);
    for (const line of linesW ?? []) {
      const item = itemsForConversion.find((i) => i.id === line?.itemId);
      if (itemIsBatchTracked(item)) next.add('batchAndExpiry');
      if (itemHasApparelVariants(item)) {
        next.add('color');
        next.add('size');
      }
    }
    return INVOICE_LINE_COLUMN_DEFS.filter((c) => next.has(c.id)).map((c) => c.id);
  }, [visibleColumnIds, linesW, itemsForConversion]);
  const visibleSet = useMemo(() => new Set(effectiveColumnIds), [effectiveColumnIds]);
  const fieldOrder = useMemo(() => buildFocusFieldOrder(effectiveColumnIds), [effectiveColumnIds]);

  const columnDefs = useMemo(
    () => INVOICE_LINE_COLUMN_DEFS.filter((c) => visibleSet.has(c.id)),
    [visibleSet]
  );

  const invoiceLineKeyHandlers = useCallback(
    (index: number) => ({
      gridId,
      lineIndex: index,
      fieldOrder,
      onAppendLine,
      onRemoveLine,
    }),
    [gridId, fieldOrder, onAppendLine, onRemoveLine]
  );

  const colSpan = columnDefs.length;

  useEffect(() => {
    if (readOnly) return;
    if (fields.length === 0) {
      onAppendLine();
      return;
    }
    const lastLine = linesW?.[fields.length - 1];
    if (lastLine?.itemId?.trim()) onAppendLine();
  }, [fields.length, linesW, onAppendLine, readOnly]);

  const applyBulkDiscount = () => {
    const raw = window.prompt('نسبة الخصم % لتطبيقها على كل السطور');
    if (raw == null) return;
    const n = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(n)) return;
    fields.forEach((_, i) => {
      setValue(`lines.${i}.discountType`, 'PERCENTAGE', { shouldDirty: true });
      setValue(`lines.${i}.discountValue`, n, { shouldDirty: true });
      setValue(`lines.${i}.discount`, n, { shouldDirty: true });
    });
  };

  const applyBulkCostCenter = () => {
    const id = window.prompt('معرّف مركز التكلفة (أو اختر من القائمة في أي سطر ثم انسخ المعرف)');
    if (!id?.trim()) return;
    fields.forEach((_, i) => setValue(`lines.${i}.costCenterId`, id.trim(), { shouldDirty: true }));
  };

  const headerForColumn = (id: InvoiceLineColumnId, label: string) => {
    if (id === 'taxRate') {
      return (
        <span title={VAT_LABEL_AR} className="inline-block">
          {label}
        </span>
      );
    }
    if (id === 'discount') {
      return (
        <TableColumnHeaderDropdown
          label={label}
          className={modernUi ? '' : undefined}
          actions={[{ id: 'bulk-discount', label: 'تطبيق خصم محدد على كل السطور', onClick: applyBulkDiscount }]}
        />
      );
    }
    if (id === 'costCenter') {
      return (
        <TableColumnHeaderDropdown
          label={label}
          actions={[
            { id: 'bulk-cc', label: 'تطبيق مركز التكلفة على الكل', onClick: applyBulkCostCenter },
          ]}
        />
      );
    }
    return label;
  };

  const renderHeader = (id: InvoiceLineColumnId) => {
    const def = INVOICE_LINE_COLUMN_DEFS.find((c) => c.id === id);
    return headerForColumn(id, def?.labelAr ?? id);
  };

  return (
    <>
      <div
        ref={gridContainerRef}
        className={
          modernUi
            ? `${ERP_INVOICE_ITEMS_CARD_CLASS} rounded-xl border border-slate-200 bg-white shadow-sm`
            : `${ERP_INVOICE_ITEMS_CARD_CLASS} rounded-2xl border border-[#D6EAF3] bg-white`
        }
      >
        <div
          className={
            modernUi
              ? 'text-[#094C6B] font-semibold text-sm px-4 py-3 border-b border-[#D6EAF3] bg-white flex flex-wrap items-center justify-between gap-3'
              : 'text-[#0E78AA] font-bold text-sm px-4 py-3 border-b border-[#D6EAF3] bg-white flex flex-wrap items-center justify-between gap-3'
          }
        >
          <span>الأصناف</span>
          <div className="flex flex-wrap items-center gap-2">
            {clipboardItems?.length ? (
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Excel: الصق في الشبكة (Ctrl+V)
              </span>
            ) : null}
            <ColumnVisibilityPicker
              storageKey={storageKey}
              visibleIds={visibleColumnIds}
              onChange={onVisibleColumnIdsChange}
              companyId={companyId}
            />
          </div>
        </div>
        <div
          ref={lineGridScrollRef}
          className={`${ERP_INVOICE_ITEMS_TABLE_WRAP_CLASS} ${
            virtualizeLines ? 'max-h-[720px] overflow-y-auto' : ''
          }`}
        >
        <table className={`w-max min-w-full table-auto text-center border-separate border-spacing-0 ${modernUi ? 'text-sm' : ''}`}>
          <thead>
            <tr className={theadRowClass}>
              {columnDefs.map((col) => (
                <th key={col.id} className={`${thClass} ${ERP_SALES_COLUMN_WIDTH[col.id] ?? ''}`}>
                  {renderHeader(col.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-[#0A3D5E] text-sm border-x border-[#D6EAF3]">
                  لا توجد أسطر. اضغط «إضافة سطر» لإدخال أصناف الفاتورة.
                </td>
              </tr>
            ) : (
              <>
              {topSpacer > 0 ? (
                <tr aria-hidden>
                  <td colSpan={colSpan} style={{ height: topSpacer, padding: 0, border: 0 }} />
                </tr>
              ) : null}
              {visibleLineIndexes.map((index) => {
                const field = fields[index]!;
                const lineErrors = errors.lines?.[index];
                const line = linesW?.[index];

                return (
                  <tr
                    key={field.id}
                    className={
                      modernUi
                        ? 'border-b border-[#E8F1F6] hover:bg-[#E8F4FA] transition-colors'
                        : `${index % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}`
                    }
                  >
                    {columnDefs.map((col) => {
                      switch (col.id) {
                        case 'rowIndex':
                          return (
                            <td key={col.id} className={tdBase('rowIndex')}>
                              {index + 1}
                            </td>
                          );
                        case 'warehouse':
                          return (
                            <td key={col.id} className={tdBase('warehouse')}>
                              <Controller
                                control={control}
                                name={`lines.${index}.warehouseId`}
                                render={({ field: f }) => (
                                  <WarehouseSelect
                                    value={f.value || warehouseId || ''}
                                    onChange={f.onChange}
                                    allowEmpty={false}
                                    className={`${lineInputCls} ${lineInputErr(!!lineErrors?.warehouseId)}`}
                                    nativeSelectProps={{
                                      ...lineGridDataAttrs(gridId, index, 'warehouse'),
                                      onKeyDown: (e) =>
                                        handleLineGridKeyDown(e, invoiceLineKeyHandlers(index)),
                                    }}
                                  />
                                )}
                              />
                            </td>
                          );
                        case 'stockBalance': {
                          const stockItem = itemsForConversion.find((i) => i.id === line?.itemId);
                          return (
                            <td key={col.id} className={tdBase('stockBalance')}>
                              <InvoiceLineStockBalanceCell
                                itemId={line?.itemId}
                                warehouseId={line?.warehouseId || warehouseId}
                                fallbackOnHand={
                                  stockItem && 'onHandQuantity' in stockItem
                                    ? (stockItem.onHandQuantity as number | null | undefined)
                                    : undefined
                                }
                              />
                            </td>
                          );
                        }
                        case 'item':
                          return (
                            <td key={col.id} className={tdBase('item', 'text-right')}>
                              <Controller
                                control={control}
                                name={`lines.${index}.itemId`}
                                render={({ field: f }) => (
                                  <ItemSelect
                                    value={f.value ?? ''}
                                    onChange={f.onChange}
                                    disabled={itemsLoading}
                                    className={`${lineInputCls} ${lineInputErr(!!lineErrors?.itemId)}`}
                                    onItemResolved={(picked) => {
                                      if (picked && 'units' in picked) {
                                        applyPickedItemToLine(index, picked as Item);
                                      } else if (
                                        picked &&
                                        'id' in picked &&
                                        'unitId' in picked &&
                                        picked.unitId
                                      ) {
                                        applyPickedItemToLine(index, {
                                          id: picked.id,
                                          arabicName: picked.arabicName,
                                          serial: picked.serial ?? undefined,
                                          units: [
                                            {
                                              unitId: picked.unitId,
                                              isBaseUnit: true,
                                              unit: { id: picked.unitId, arabicName: '' },
                                            },
                                          ],
                                          defaultTaxPercent:
                                            'defaultTaxPercent' in picked ? picked.defaultTaxPercent : undefined,
                                          taxExemptionReason:
                                            'taxExemptionReason' in picked ? picked.taxExemptionReason : undefined,
                                        });
                                        if ('salesPrice' in picked && picked.salesPrice != null) {
                                          setValue(`lines.${index}.unitPrice`, picked.salesPrice, {
                                            shouldDirty: true,
                                          });
                                        }
                                      }
                                    }}
                                    onAfterBarcodePick={() => {
                                      setValue(`lines.${index}.quantity`, 1, { shouldDirty: true });
                                      focusLineField(gridId, index, 'quantity');
                                    }}
                                    inputProps={{
                                      ...lineGridDataAttrs(gridId, index, 'item'),
                                    }}
                                    onInputKeyDown={(e) =>
                                      handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                    }
                                    quickCreateModal={ItemQuickAddModal}
                                  />
                                )}
                              />
                              <FieldError message={lineErrors?.itemId?.message} show={fieldErrShow} className={fieldErrClass} />
                            </td>
                          );
                        case 'quantity':
                          return (
                            <td key={col.id} className={tdBase('quantity')}>
                              <Controller
                                control={control}
                                name={`lines.${index}.quantity`}
                                render={({ field: f }) => (
                                  <TableNumberInput
                                    value={f.value as number | string | undefined}
                                    onValueCommit={(n) => {
                                      f.onChange(n);
                                      syncLineUnits(index, { quantity: n });
                                    }}
                                    className={`${lineInputCls} text-center ${lineInputErr(!!lineErrors?.quantity)}`}
                                    {...lineGridDataAttrs(gridId, index, 'quantity')}
                                    onKeyDown={(e) =>
                                      handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                    }
                                  />
                                )}
                              />
                              <FieldError message={lineErrors?.quantity?.message} show={fieldErrShow} className={fieldErrClass} />
                            </td>
                          );
                        case 'unitPrice': {
                          const pricedItem = itemsForConversion.find((i) => i.id === line?.itemId);
                          const lineCost = Number(pricedItem?.averageCost ?? 0);
                          const linePrice = Number(line?.unitPrice ?? 0);
                          const belowCost =
                            preventSellingBelowCost &&
                            isPriceBelowAverageCost(linePrice, lineCost);
                          return (
                            <td key={col.id} className={tdBase('unitPrice')}>
                              <Controller
                                control={control}
                                name={`lines.${index}.unitPrice`}
                                render={({ field: f }) => (
                                  <TableNumberInput
                                    value={f.value as number | string | undefined}
                                    onValueCommit={(n) => f.onChange(n)}
                                    disabled={readOnly || lockUnitPrice}
                                    title={
                                      lockUnitPrice
                                        ? 'تعديل السعر غير مسموح في إعدادات الفاتورة'
                                        : undefined
                                    }
                                    className={`${lineInputCls} text-center ${lineInputErr(!!lineErrors?.unitPrice)} ${belowCost ? 'border-amber-400 bg-amber-50' : ''} ${lockUnitPrice ? 'bg-slate-50 text-slate-500' : ''}`}
                                    {...lineGridDataAttrs(gridId, index, 'unitPrice')}
                                    onKeyDown={(e) =>
                                      handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                    }
                                  />
                                )}
                              />
                              {belowCost ? (
                                <span
                                  className="mt-0.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                                  title={`سعر التكلفة ${lineCost.toFixed(2)}`}
                                >
                                  أقل من التكلفة
                                </span>
                              ) : null}
                              <FieldError message={lineErrors?.unitPrice?.message} show={fieldErrShow} className={fieldErrClass} />
                            </td>
                          );
                        }
                        case 'discount':
                          return (
                            <td key={col.id} className={tdBase('discount')}>
                              <Controller
                                control={control}
                                name={`lines.${index}.discountValue`}
                                render={({ field: f }) => (
                                  <InvoiceLineDiscountInput
                                    value={f.value ?? line?.discount}
                                    discountType={line?.discountType}
                                    onValueCommit={(n) => {
                                      f.onChange(n);
                                      setValue(`lines.${index}.discount`, n, {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      });
                                    }}
                                    onTypeChange={(next: DiscountType) =>
                                      setValue(`lines.${index}.discountType`, next, {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      })
                                    }
                                    error={!!lineErrors?.discountValue || !!lineErrors?.discount}
                                    {...lineGridDataAttrs(gridId, index, 'discount')}
                                    onKeyDown={(e) =>
                                      handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                    }
                                  />
                                )}
                              />
                              <FieldError
                                message={lineErrors?.discountValue?.message ?? lineErrors?.discount?.message}
                                show={fieldErrShow}
                                className={fieldErrClass}
                              />
                            </td>
                          );
                        case 'total': {
                          const sub = computeLineSubtotalAfterDiscount(line ?? {}, pricingCalculationBasis);
                          const taxPct = Number(line?.taxRate) || 0;
                          const lineTotal = sub + sub * (taxPct / 100);
                          return (
                            <td key={col.id} className={tdBase('total', 'tabular-nums whitespace-nowrap')}>
                              {lineTotal.toLocaleString('ar-EG', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          );
                        }
                        case 'barcode':
                          return (
                            <td key={col.id} className={tdBase('barcode')}>
                              <input
                                className={`${lineInputCls}`}
                                placeholder="مسح أو إدخال"
                                autoComplete="off"
                                {...register(`lines.${index}.barcode`)}
                                {...lineGridDataAttrs(gridId, index, 'barcode')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const code = e.currentTarget.value.trim();
                                    if (code) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void findItemByBarcode(code, itemsForConversion).then((found) => {
                                        if (!found) {
                                          toast.error('الباركود غير مسجل');
                                          return;
                                        }
                                        setValue(`lines.${index}.itemId`, found.id, { shouldDirty: true });
                                        setValue(`lines.${index}.barcode`, itemBarcodeValue(found, code), {
                                          shouldDirty: true,
                                        });
                                        if (!line?.itemId) {
                                          setValue(`lines.${index}.quantity`, 1, { shouldDirty: true });
                                        }
                                        applyPickedItemToLine(index, found);
                                        if (found.salesPrice != null) {
                                          setValue(`lines.${index}.unitPrice`, Number(found.salesPrice), {
                                            shouldDirty: true,
                                          });
                                        }
                                        focusLineField(gridId, index, 'quantity');
                                      });
                                      return;
                                    }
                                  }
                                  handleLineGridKeyDown(e, invoiceLineKeyHandlers(index));
                                }}
                              />
                            </td>
                          );
                        case 'unit':
                          return (
                            <td key={col.id} className={tdBase('unit')}>
                              <Controller
                                control={control}
                                name={`lines.${index}.unitId`}
                                render={({ field: f }) => (
                                  <ItemUnitSelect
                                    itemId={line?.itemId ?? ''}
                                    value={f.value ?? ''}
                                    onChange={(unitId) => {
                                      f.onChange(unitId);
                                      syncLineUnits(index, { unitId });
                                    }}
                                    className={`${lineInputCls}`}
                                    nativeSelectProps={{
                                      ...lineGridDataAttrs(gridId, index, 'unit'),
                                      onKeyDown: (e) =>
                                        handleLineGridKeyDown(e, invoiceLineKeyHandlers(index)),
                                    }}
                                  />
                                )}
                              />
                            </td>
                          );
                        case 'baseQuantity': {
                          const item = itemsForConversion.find((i) => i.id === line?.itemId);
                          const link = item?.units?.find((u) => (u.unit?.id ?? u.unitId) === line?.unitId);
                          const fixed = link?.isFactorFixed !== false;
                          const baseLabel = baseUnitLabelForItem(item);
                          const shortUnit =
                            baseUnitLinkForItem(item)?.unit?.arabicName ||
                            baseUnitLinkForItem(item)?.unit?.code ||
                            '';
                          return (
                            <td key={col.id} className={tdBase('baseQuantity')}>
                              <div className="flex items-center gap-1">
                                <Controller
                                  control={control}
                                  name={`lines.${index}.baseQuantity`}
                                  render={({ field: f }) => (
                                    <TableNumberInput
                                      value={f.value as number | string | undefined}
                                      onValueCommit={(n) => {
                                        f.onChange(n);
                                        syncLineUnits(index, { baseQuantity: n });
                                      }}
                                      disabled={fixed}
                                      className={`${lineInputCls} text-center ${fixed ? 'bg-slate-50 text-slate-600' : ''}`}
                                      {...lineGridDataAttrs(gridId, index, 'baseQuantity')}
                                      onKeyDown={(e) =>
                                        handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                      }
                                    />
                                  )}
                                />
                                <span className="shrink-0 text-[11px] text-slate-500 whitespace-nowrap">
                                  {shortUnit || baseLabel}
                                </span>
                              </div>
                            </td>
                          );
                        }
                        case 'baseUnit': {
                          const item = itemsForConversion.find((i) => i.id === line?.itemId);
                          const baseLabel = baseUnitLabelForItem(item);
                          const baseQty = Number(line?.baseQuantity);
                          return (
                            <td key={col.id} className={tdBase('baseUnit', 'text-sm text-slate-600')}>
                              <div className="px-1 text-right leading-tight">{baseLabel}</div>
                              {Number.isFinite(baseQty) && baseQty > 0 && line?.itemId ? (
                                <div className="px-1 text-[11px] text-slate-500 tabular-nums">
                                  {baseQty.toLocaleString('ar-EG', { maximumFractionDigits: 3 })}
                                </div>
                              ) : null}
                            </td>
                          );
                        }
                        case 'taxRate':
                          return (
                            <td key={col.id} className={tdBase('taxRate')} title={VAT_LABEL_AR}>
                              <Controller
                                control={control}
                                name={`lines.${index}.taxRate`}
                                render={({ field: f }) => (
                                  <TableNumberInput
                                    value={f.value as number | string | undefined}
                                    onValueCommit={(n) => f.onChange(n)}
                                    title={VAT_LABEL_AR}
                                    aria-label={VAT_LABEL_AR}
                                    className={`${lineInputCls} text-center ${lineInputErr(!!lineErrors?.taxRate)}`}
                                    {...lineGridDataAttrs(gridId, index, 'taxRate')}
                                    onKeyDown={(e) =>
                                      handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                    }
                                  />
                                )}
                              />
                            </td>
                          );
                        case 'costCenter':
                          return (
                            <td key={col.id} className={tdBase('costCenter')}>
                              <Controller
                                control={control}
                                name={`lines.${index}.costCenterId`}
                                render={({ field: f }) => (
                                  <CostCenterSelect
                                    value={f.value ?? ''}
                                    onChange={f.onChange}
                                    className={lineInputCls}
                                    nativeSelectProps={{
                                      ...lineGridDataAttrs(gridId, index, 'costCenter'),
                                      onKeyDown: (e) =>
                                        handleLineGridKeyDown(e, invoiceLineKeyHandlers(index)),
                                    }}
                                  />
                                )}
                              />
                            </td>
                          );
                        case 'lineAccount':
                          return (
                            <td key={col.id} className={tdBase('lineAccount')}>
                              <Controller
                                control={control}
                                name={`lines.${index}.customRevenueAccountId`}
                                render={({ field: f }) => (
                                  <AccountSelect
                                    value={f.value ?? line?.lineAccountId ?? ''}
                                    onChange={(id) => {
                                      f.onChange(id);
                                      setValue(`lines.${index}.lineAccountId`, id, { shouldDirty: true });
                                    }}
                                    className={lineInputCls}
                                    leafOnly
                                  />
                                )}
                              />
                            </td>
                          );
                        case 'withholdingTax': {
                          const row = calculateRowTotals(line ?? {}, { pricingCalculationBasis });
                          return (
                            <td key={col.id} className={tdBase('withholdingTax')}>
                              <LineWithholdingTaxCell
                                rate={Number(line?.withholdingTaxRate ?? 0)}
                                amount={Number(line?.withholdingTaxAmount ?? 0)}
                                lineAfterDiscount={row.lineAfterDiscount}
                                onChange={(patch) => {
                                  setValue(`lines.${index}.withholdingTaxRate`, patch.withholdingTaxRate, {
                                    shouldDirty: true,
                                  });
                                  setValue(`lines.${index}.withholdingTaxAmount`, patch.withholdingTaxAmount, {
                                    shouldDirty: true,
                                  });
                                }}
                              />
                            </td>
                          );
                        }
                        case 'batchAndExpiry': {
                          const item = itemsForConversion.find((i) => i.id === line?.itemId);
                          return (
                            <td key={col.id} className={tdBase('batchAndExpiry')}>
                              <SmartBatchExpiryCell
                                item={item}
                                itemId={line?.itemId}
                                warehouseId={line?.warehouseId || warehouseId}
                                quantity={Number(line?.quantity ?? 0)}
                                batchNumber={line?.batchNumber}
                                expiryDate={line?.expiryDate}
                                allocations={line?.batchAllocations}
                                onChange={(patch) => {
                                  if (patch.batchNumber !== undefined) {
                                    setValue(`lines.${index}.batchNumber`, patch.batchNumber, { shouldDirty: true });
                                  }
                                  if (patch.expiryDate !== undefined) {
                                    setValue(`lines.${index}.expiryDate`, patch.expiryDate, { shouldDirty: true });
                                  }
                                  if (patch.batchAllocations !== undefined) {
                                    setValue(`lines.${index}.batchAllocations`, patch.batchAllocations, {
                                      shouldDirty: true,
                                    });
                                  }
                                }}
                              />
                            </td>
                          );
                        }
                        case 'color': {
                          const item = itemsForConversion.find((i) => i.id === line?.itemId);
                          return (
                            <td key={col.id} className={tdBase('color')}>
                              <ApparelVariantCell
                                mode="color"
                                color={line?.color}
                                suggestedColor={item?.color ?? undefined}
                                onChange={(patch) =>
                                  setValue(`lines.${index}.color`, patch.color ?? '', { shouldDirty: true })
                                }
                              />
                            </td>
                          );
                        }
                        case 'size': {
                          const item = itemsForConversion.find((i) => i.id === line?.itemId);
                          return (
                            <td key={col.id} className={tdBase('size')}>
                              <ApparelVariantCell
                                mode="size"
                                size={line?.size}
                                suggestedSize={item?.size ?? undefined}
                                onChange={(patch) =>
                                  setValue(`lines.${index}.size`, patch.size ?? '', { shouldDirty: true })
                                }
                              />
                            </td>
                          );
                        }
                        case 'batchNumber':
                          return (
                            <td key={col.id} className={tdBase('batchNumber')}>
                              <input
                                className={`${lineInputCls}`}
                                {...register(`lines.${index}.batchNumber`)}
                                {...lineGridDataAttrs(gridId, index, 'batchNumber')}
                                onKeyDown={(e) =>
                                  handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                }
                              />
                            </td>
                          );
                        case 'expiryDate':
                          return (
                            <td key={col.id} className={tdBase('expiryDate')}>
                              <input
                                type="date"
                                className={`${lineInputCls}`}
                                {...register(`lines.${index}.expiryDate`)}
                                {...lineGridDataAttrs(gridId, index, 'expiryDate')}
                                onKeyDown={(e) =>
                                  handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                }
                              />
                            </td>
                          );
                        case 'notes':
                          return (
                            <td key={col.id} className={tdBase('notes')}>
                              <input
                                className={`${lineInputCls}`}
                                {...register(`lines.${index}.lineNotes`)}
                                {...lineGridDataAttrs(gridId, index, 'notes')}
                                onKeyDown={(e) =>
                                  handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                }
                              />
                            </td>
                          );
                        case 'productionDate':
                          return (
                            <td key={col.id} className={tdBase('productionDate')}>
                              <input
                                type="date"
                                className={`${lineInputCls}`}
                                {...register(`lines.${index}.productionDate`)}
                                {...lineGridDataAttrs(gridId, index, 'productionDate')}
                                onKeyDown={(e) =>
                                  handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                }
                              />
                            </td>
                          );
                        case 'serialNumbers':
                          return (
                            <td key={col.id} className={tdBase('serialNumbers')}>
                              <input
                                className={`${lineInputCls}`}
                                placeholder="SN-1, SN-2…"
                                {...register(`lines.${index}.serialNumbers`)}
                                {...lineGridDataAttrs(gridId, index, 'serialNumbers')}
                                onKeyDown={(e) =>
                                  handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                }
                              />
                            </td>
                          );
                        case 'taxExemptionReason':
                          return (
                            <td key={col.id} className={tdBase('taxExemptionReason')}>
                              <input
                                className={`${lineInputCls}`}
                                {...register(`lines.${index}.taxExemptionReason`)}
                                {...lineGridDataAttrs(gridId, index, 'taxExemptionReason')}
                                onKeyDown={(e) =>
                                  handleLineGridKeyDown(e, invoiceLineKeyHandlers(index))
                                }
                              />
                            </td>
                          );
                        case 'freeBonus': {
                          const isFree =
                            (line?.discountType ?? 'PERCENTAGE') !== 'FIXED' &&
                            Number(line?.discountValue ?? line?.discount) === 100;
                          return (
                            <td key={col.id} className={tdBase('freeBonus')}>
                              <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isFree}
                                  onChange={(e) => {
                                    const n = e.target.checked ? 100 : 0;
                                    setValue(`lines.${index}.discountType`, 'PERCENTAGE', { shouldDirty: true });
                                    setValue(`lines.${index}.discountValue`, n, { shouldDirty: true });
                                    setValue(`lines.${index}.discount`, n, { shouldDirty: true });
                                  }}
                                  className="rounded border-slate-300 text-[#0E78AA] focus:ring-[#0E78AA]"
                                  {...lineGridDataAttrs(gridId, index, 'freeBonus')}
                                />
                                {isFree ? (
                                  <span className="text-[10px] font-semibold text-emerald-700">هدية</span>
                                ) : null}
                              </label>
                            </td>
                          );
                        }
                        case 'unitConversion': {
                          const factor = conversionFactorFor(line?.itemId, line?.unitId);
                          return (
                            <td key={col.id} className={tdBase('unitConversion', 'tabular-nums')}>
                              {factor != null ? factor.toLocaleString('ar-EG', { maximumFractionDigits: 6 }) : '—'}
                            </td>
                          );
                        }
                        case 'rowDelete':
                          return (
                            <td key={col.id} className={tdBase('rowDelete', 'whitespace-nowrap')}>
                              {readOnly ? null : (
                                <button
                                  type="button"
                                  onClick={onAppendLine}
                                  className="rounded-md px-1 py-1 text-[#0E78AA] transition-colors hover:bg-[#E8F4FA]"
                                  aria-label="إضافة سطر"
                                  title="إضافة سطر"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setPeekIndex(index)}
                                className="rounded-md px-1 py-1 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900"
                                aria-label="فحص الصنف"
                                title="فحص 360° (Alt+I)"
                              >
                                🔍
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveLine(index)}
                                className="rounded-md px-1 py-1 text-red-600 transition-colors hover:bg-red-50 hover:text-red-800"
                                aria-label="حذف السطر"
                                title="حذف"
                              >
                                🗑️
                              </button>
                            </td>
                          );
                        default:
                          return (
                            <td key={col.id} className={tdBase(col.id)}>
                              —
                            </td>
                          );
                      }
                    })}
                  </tr>
                );
              })}
              {bottomSpacer > 0 ? (
                <tr aria-hidden>
                  <td colSpan={colSpan} style={{ height: bottomSpacer, padding: 0, border: 0 }} />
                </tr>
              ) : null}
              </>
            )}
          </tbody>
        </table>
        </div>
        {readOnly ? null : (
          <button
            type="button"
            onClick={onAppendLine}
            className="mx-3 mt-2 mb-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0E78AA] hover:bg-[#E8F4FA]"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة سطر جديد (Enter)
          </button>
        )}
        {fields.length > 0 ? (
          <div className={`px-4 py-2 text-left text-sm border-t ${modernUi ? 'border-[#D6EAF3] text-[#094C6B] bg-white' : 'text-[#0A3D5E] border-[#D6EAF3] bg-white'}`}>
            <span className="font-semibold">إجمالي الأسطر (بعد الخصم): </span>
            {(linesW ?? [])
              .reduce((sum, line) => sum + computeLineSubtotalAfterDiscount(line ?? {}, pricingCalculationBasis), 0)
              .toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        ) : null}
      </div>

      {peekIndex != null ? (
        <ItemQuickPeekDrawer
          open
          onClose={() => setPeekIndex(null)}
          itemId={peekLine?.itemId?.trim() ? peekLine.itemId : null}
          customerId={customerId}
          unitPrice={Number(peekLine?.unitPrice ?? 0)}
        />
      ) : null}
    </>
  );
}
