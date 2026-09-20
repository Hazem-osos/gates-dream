'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import dynamic from 'next/dynamic';
import { ColumnVisibilityPicker } from '@/components/inventory/ColumnVisibilityPicker';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';

const ItemQuickPeekDrawer = dynamic(
  () =>
    import('@/components/inventory/ItemQuickPeekDrawer').then((m) => ({
      default: m.ItemQuickPeekDrawer,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل بطاقة الصنف…" /> }
);


import { AccountSelect } from '@/components/form/AccountSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import { ItemSelect } from '@/components/form/ItemSelect';
import { ItemUnitSelect } from '@/components/form/ItemUnitSelect';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { SmartBatchExpiryCell } from '@/components/invoices/SmartBatchExpiryCell';
import { LineWithholdingTaxCell } from '@/components/invoices/LineWithholdingTaxCell';
import { ApparelVariantCell } from '@/components/invoices/ApparelVariantCells';
import { InvoiceLineStockBalanceCell } from '@/components/invoices/InvoiceLineStockBalanceCell';
import { itemHasApparelVariants, itemIsBatchTracked } from '@/lib/invoices/itemTracking';
import { defaultUnitIdForItem, baseUnitLabelForItem, baseUnitLinkForItem } from '@/lib/inventory/item-units';
import { syncLineUnitFields, type PricingCalculationBasis } from '@/lib/invoices/unit-conversion';
import { findItemByBarcode, itemBarcodeValue } from '@/lib/inventory/findItemByBarcode';
import { toast } from '@/lib/feedback/toast';
import { useItemsQuery } from '@/lib/hooks/useMasterDataQueries';
import {
  INVOICE_LINE_COLUMN_DEFS,
  type InvoiceColumnStorageKey,
  type InvoiceLineColumnId,
  type InvoiceLineExtended,
  buildFocusFieldOrder,
} from '@/lib/invoices/invoiceLineColumns';
import { computeLineSubtotalAfterDiscount } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { VAT_LABEL_AR, type DiscountType } from '@/lib/invoices/discount-type';
import { InvoiceLineDiscountInput } from '@/components/inventory/InvoiceLineDiscountInput';
import { LandedCostInspector } from '@/components/inventory/purchase-invoice/LandedCostInspector';
import {
  buildLandedCostBreakdown,
  type LandedCostExtras,
} from '@/lib/invoices/landed-cost-breakdown';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import {
  handleLineGridKeyDown,
  lineGridDataAttrs,
  focusLineField,
  focusNextLineField,
} from '@/lib/keyboard/gridLineFocus';
import {
  ERP_INVOICE_ITEMS_CARD_CLASS,
  ERP_INVOICE_ITEMS_TABLE_WRAP_CLASS,
  ERP_PURCHASE_COLUMN_WIDTH,
  erpLineGridInputClass,
  erpTableHeadCellClass,
  erpTableHeadRowClass,
} from '@/components/erp/erpUiTokens';
import { useClipboardTablePaste } from '@/lib/hooks/useClipboardTablePaste';
import { useFollowHeaderDescription } from '@/lib/hooks/useFollowHeaderDescription';
import {
  parseInvoiceLinesFromClipboard,
  type ClipboardItemRef,
} from '@/lib/inventory/clipboardTablePaste';

export type PurchaseInvoiceLine = InvoiceLineExtended & {
  itemId: string;
  unitId?: string;
  quantity: number;
  baseQuantity?: number;
  conversionFactor?: number;
  baseUnitId?: string;
  unitPrice: number;
  discount?: number;
  discountValue?: number;
  discountType?: DiscountType | string;
  tax?: number;
};

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
  salesPrice?: number | null;
  averageCost?: number | string | null;
  onHandQuantity?: number | null;
  defaultTaxPercent?: number | string | null;
  useExpirationDate?: boolean | null;
  useSerialNumber?: boolean | null;
  clothingItem?: boolean | null;
  trackingType?: string | null;
  hasExpiry?: boolean | null;
  color?: string | null;
  size?: string | null;
  colorId?: string | null;
}

const inputClsBase =
  'w-full p-2.5 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA]/20 focus:border-[#0E78AA] focus:bg-white transition-all duration-200';

const PURCHASE_GRID_ID = 'purchase-invoice-lines';

type Props = {
  storageKey: InvoiceColumnStorageKey;
  lines: PurchaseInvoiceLine[];
  onChange: (lines: PurchaseInvoiceLine[]) => void;
  itemsLoading?: boolean;
  warehouseId?: string;
  visibleColumnIds: InvoiceLineColumnId[];
  onVisibleColumnIdsChange: (ids: InvoiceLineColumnId[]) => void;
  modernUi?: boolean;
  inputClassName?: string;
  clipboardItems?: ClipboardItemRef[];
  onClipboardLines?: (lines: ReturnType<typeof parseInvoiceLinesFromClipboard>['lines']) => void;
  pricingCalculationBasis?: PricingCalculationBasis | string;
  readOnly?: boolean;
  lockUnitPrice?: boolean;
  hideAddLine?: boolean;
  landedCostExtras?: LandedCostExtras;
  allLinesForLandedCost?: PurchaseInvoiceLine[];
  headerDescription?: string;
};

function patchLine(lines: PurchaseInvoiceLine[], index: number, patch: Partial<PurchaseInvoiceLine>) {
  return lines.map((l, i) => (i === index ? { ...l, ...patch } : l));
}

type PurchaseLineRowProps = {
  index: number;
  line: PurchaseInvoiceLine;
  columnDefs: { id: InvoiceLineColumnId }[];
  modernUi: boolean;
  lineInputCls: string;
  itemsLoading: boolean;
  warehouseId?: string;
  itemsForBaseUnit: Item[];
  fieldOrder: string[];
  onPatch: (index: number, patch: Partial<PurchaseInvoiceLine>) => void;
  onPeek: (index: number) => void;
  onRemove: (index: number) => void;
  onAppend: () => void;
  readOnly?: boolean;
  applyPickedItem: (index: number, picked: Item | undefined) => void;
  pricingCalculationBasis?: PricingCalculationBasis | string;
  lockUnitPrice?: boolean;
  landedCostExtras?: LandedCostExtras;
  allLines?: PurchaseInvoiceLine[];
};

const PurchaseInvoiceLineRow = memo(function PurchaseInvoiceLineRow({
  index,
  line,
  columnDefs,
  modernUi,
  lineInputCls,
  itemsLoading,
  warehouseId,
  itemsForBaseUnit,
  fieldOrder,
  onPatch,
  onPeek,
  onRemove,
  onAppend,
  readOnly = false,
  applyPickedItem,
  pricingCalculationBasis = 'SELECTED_UNIT_QTY',
  lockUnitPrice = false,
  landedCostExtras,
  allLines,
}: PurchaseLineRowProps) {
  const handlers = {
    gridId: PURCHASE_GRID_ID,
    lineIndex: index,
    fieldOrder,
    onAppendLine: onAppend,
    onRemoveLine: onRemove,
  };
  const sub = computeLineSubtotalAfterDiscount(
    {
      quantity: line.quantity,
      baseQuantity: line.baseQuantity,
      unitPrice: line.unitPrice,
      discount: line.discountValue ?? line.discount,
      discountValue: line.discountValue ?? line.discount,
      discountType: line.discountType,
      taxRate: line.tax,
    },
    pricingCalculationBasis
  );

  return (
    <tr
      className={
        modernUi
          ? 'border-b border-[#E8F1F6] hover:bg-[#E8F4FA] transition-colors'
          : index % 2 === 0
            ? 'bg-[#F6FBFD]'
            : 'bg-white'
      }
      onDoubleClick={() => onPeek(index)}
    >
      {columnDefs.map((col) => {
        switch (col.id) {
          case 'rowIndex':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                {index + 1}
              </td>
            );
          case 'warehouse':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3] min-w-[9rem]">
                <WarehouseSelect
                  value={line.warehouseId || warehouseId || ''}
                  onChange={(id) => onPatch(index, { warehouseId: id })}
                  allowEmpty={false}
                  className={`${lineInputCls} text-sm py-2`}
                  nativeSelectProps={{
                    ...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'warehouse'),
                    onKeyDown: (e) => handleLineGridKeyDown(e, handlers),
                  }}
                />
              </td>
            );
          case 'stockBalance': {
            const stockItem = itemsForBaseUnit.find((i) => i.id === line.itemId);
            return (
              <td
                key={col.id}
                className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.stockBalance ?? ''}`}
              >
                <InvoiceLineStockBalanceCell
                  itemId={line.itemId}
                  warehouseId={line.warehouseId || warehouseId}
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
              <td key={col.id} className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.item ?? 'min-w-[220px]'}`}>
                <ItemSelect
                  value={line.itemId}
                  onChange={(id) => onPatch(index, { itemId: id })}
                  disabled={itemsLoading}
                  className={`${lineInputCls} text-sm`}
                  onItemResolved={(picked) => {
                    if (picked && 'units' in picked) {
                      applyPickedItem(index, picked as Item);
                    }
                    if (picked) {
                      focusNextLineField(PURCHASE_GRID_ID, index, fieldOrder, 'item', 16);
                    }
                  }}
                  onAfterBarcodePick={() => {
                    onPatch(index, { quantity: 1 });
                    focusLineField(PURCHASE_GRID_ID, index, 'quantity');
                  }}
                  inputProps={{
                    ...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'item'),
                  }}
                  onInputKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'quantity':
            return (
              <td key={col.id} className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.quantity ?? ''}`}>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`${lineInputCls} text-sm text-center`}
                  value={line.quantity}
                  onChange={(e) =>
                    onPatch(index, {
                      quantity: Number(e.target.value) || 0,
                    })
                  }
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'quantity')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'unitPrice':
            return (
              <td key={col.id} className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.unitPrice ?? ''}`}>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`${lineInputCls} text-sm text-center ${lockUnitPrice ? 'bg-slate-50 text-slate-500' : ''}`}
                  value={line.unitPrice}
                  disabled={lockUnitPrice}
                  title={lockUnitPrice ? 'السعر مثبت على سعر فاتورة البيع الأصلية' : undefined}
                  onChange={(e) =>
                    onPatch(index, {
                      unitPrice: Number(e.target.value) || 0,
                    })
                  }
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'unitPrice')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'landedCost': {
            const item = itemsForBaseUnit.find((row) => row.id === line.itemId);
            const breakdown = buildLandedCostBreakdown(line, allLines ?? [line], landedCostExtras, {
              pricingCalculationBasis,
              previousAverageCost: item?.averageCost != null ? Number(item.averageCost) : undefined,
              onHandQuantity: item?.onHandQuantity != null ? Number(item.onHandQuantity) : undefined,
            });
            return (
              <td
                key={col.id}
                className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.landedCost ?? ''}`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="tabular-nums text-sm font-semibold text-[#0A3D5E]">
                    {formatInvoiceMoney(breakdown.landedUnitCost)}
                  </span>
                  <LandedCostInspector breakdown={breakdown} />
                </div>
              </td>
            );
          }
          case 'discount':
            return (
              <td key={col.id} className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.discount ?? ''}`}>
                <InvoiceLineDiscountInput
                  value={line.discountValue ?? line.discount ?? 0}
                  discountType={line.discountType}
                  onValueCommit={(n) =>
                    onPatch(index, {
                      discount: n,
                      discountValue: n,
                    })
                  }
                  onTypeChange={(next) => onPatch(index, { discountType: next })}
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'discount')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'total':
            return (
              <td key={col.id} className={`py-2 px-2 border-x border-[#D6EAF3] text-sm font-medium ${ERP_PURCHASE_COLUMN_WIDTH.total ?? ''}`}>
                {sub.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            );
          case 'barcode':
            return (
              <td key={col.id} className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.barcode ?? ''}`}>
                <input
                  className={`${lineInputCls} text-sm`}
                  placeholder="مسح أو إدخال"
                  autoComplete="off"
                  value={line.barcode ?? ''}
                  onChange={(e) => onPatch(index, { barcode: e.target.value })}
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'barcode')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const code = e.currentTarget.value.trim();
                      if (code) {
                        e.preventDefault();
                        e.stopPropagation();
                        void findItemByBarcode(code, itemsForBaseUnit).then((found) => {
                          if (!found) {
                            toast.error('الباركود غير مسجل');
                            return;
                          }
                          applyPickedItem(index, found);
                          focusLineField(PURCHASE_GRID_ID, index, 'quantity');
                        });
                        return;
                      }
                    }
                    handleLineGridKeyDown(e, handlers);
                  }}
                />
              </td>
            );
          case 'unit':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <ItemUnitSelect
                  itemId={line.itemId}
                  value={line.unitId ?? ''}
                  onChange={(unitId) => onPatch(index, { unitId })}
                  className={`${lineInputCls} text-sm py-2`}
                  nativeSelectProps={{
                    ...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'unit'),
                    onKeyDown: (e) => handleLineGridKeyDown(e, handlers),
                  }}
                />
              </td>
            );
          case 'baseQuantity': {
            const item = itemsForBaseUnit.find((i) => i.id === line.itemId);
            const link = item?.units?.find((u) => (u.unit?.id ?? u.unitId) === line.unitId);
            const fixed = link?.isFactorFixed !== false;
            const shortUnit =
              baseUnitLinkForItem(item)?.unit?.arabicName ||
              baseUnitLinkForItem(item)?.unit?.code ||
              '';
            return (
              <td
                key={col.id}
                className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.baseQuantity ?? ''}`}
              >
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={fixed}
                    className={`${lineInputCls} text-sm text-center ${fixed ? 'bg-slate-50 text-slate-600' : ''}`}
                    value={line.baseQuantity ?? ''}
                    onChange={(e) =>
                      onPatch(index, { baseQuantity: Number(e.target.value) || 0 })
                    }
                    {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'baseQuantity')}
                    onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                  />
                  <span className="shrink-0 text-[11px] text-slate-500">{shortUnit}</span>
                </div>
              </td>
            );
          }
          case 'baseUnit': {
            const item = itemsForBaseUnit.find((i) => i.id === line.itemId);
            const baseLabel = baseUnitLabelForItem(item);
            const baseQty = Number(line.baseQuantity);
            return (
              <td
                key={col.id}
                className={`py-2 px-2 border-x border-[#D6EAF3] text-sm text-slate-600 ${modernUi ? ERP_PURCHASE_COLUMN_WIDTH.baseUnit ?? '' : ''}`}
              >
                <div className="text-right leading-tight">{baseLabel}</div>
                {Number.isFinite(baseQty) && baseQty > 0 && line.itemId ? (
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {baseQty.toLocaleString('ar-EG', { maximumFractionDigits: 3 })}
                  </div>
                ) : null}
              </td>
            );
          }
          case 'taxRate':
            return (
              <td
                key={col.id}
                title={VAT_LABEL_AR}
                className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.taxRate ?? ''}`}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  title={VAT_LABEL_AR}
                  aria-label={VAT_LABEL_AR}
                  className={`${lineInputCls} text-sm text-center`}
                  value={line.tax ?? 0}
                  onChange={(e) => onPatch(index, { tax: Number(e.target.value) || 0 })}
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'taxRate')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'costCenter':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <CostCenterSelect
                  value={line.costCenterId ?? ''}
                  onChange={(id) => onPatch(index, { costCenterId: id || undefined })}
                  className={`${lineInputCls} text-sm py-2`}
                  nativeSelectProps={{
                    ...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'costCenter'),
                    onKeyDown: (e) => handleLineGridKeyDown(e, handlers),
                  }}
                />
              </td>
            );
          case 'lineAccount':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <AccountSelect
                  value={line.customRevenueAccountId ?? line.lineAccountId ?? ''}
                  onChange={(id) =>
                    onPatch(index, { customRevenueAccountId: id || undefined, lineAccountId: id || undefined })
                  }
                  className={`${lineInputCls} text-sm`}
                  leafOnly
                />
              </td>
            );
          case 'withholdingTax':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <LineWithholdingTaxCell
                  rate={Number(line.withholdingTaxRate ?? 0)}
                  amount={Number(line.withholdingTaxAmount ?? 0)}
                  lineAfterDiscount={sub}
                  onChange={(patch) => onPatch(index, patch)}
                />
              </td>
            );
          case 'batchAndExpiry': {
            const item = itemsForBaseUnit.find((i) => i.id === line.itemId);
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <SmartBatchExpiryCell
                  item={item}
                  itemId={line.itemId}
                  warehouseId={line.warehouseId || warehouseId}
                  quantity={Number(line.quantity ?? 0)}
                  batchNumber={line.batchNumber}
                  expiryDate={line.expiryDate}
                  allocations={line.batchAllocations}
                  onChange={(patch) => onPatch(index, patch)}
                />
              </td>
            );
          }
          case 'color': {
            const item = itemsForBaseUnit.find((i) => i.id === line.itemId);
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <ApparelVariantCell
                  mode="color"
                  color={line.color}
                  suggestedColor={item?.color ?? undefined}
                  onChange={(patch) => onPatch(index, { color: patch.color })}
                />
              </td>
            );
          }
          case 'size': {
            const item = itemsForBaseUnit.find((i) => i.id === line.itemId);
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <ApparelVariantCell
                  mode="size"
                  size={line.size}
                  suggestedSize={item?.size ?? undefined}
                  onChange={(patch) => onPatch(index, { size: patch.size })}
                />
              </td>
            );
          }
          case 'batchNumber':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <input
                  className={`${lineInputCls} text-sm`}
                  value={line.batchNumber ?? ''}
                  onChange={(e) => onPatch(index, { batchNumber: e.target.value })}
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'batchNumber')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'expiryDate':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <input
                  type="date"
                  className={`${lineInputCls} text-sm`}
                  value={line.expiryDate ?? ''}
                  onChange={(e) => onPatch(index, { expiryDate: e.target.value })}
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'expiryDate')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'notes':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <input
                  className={`${lineInputCls} text-sm`}
                  value={line.lineNotes ?? ''}
                  onChange={(e) => onPatch(index, { lineNotes: e.target.value })}
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'notes')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'productionDate':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <input
                  type="date"
                  className={`${lineInputCls} text-sm`}
                  value={line.productionDate ?? ''}
                  onChange={(e) => onPatch(index, { productionDate: e.target.value })}
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'productionDate')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'serialNumbers':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <input
                  className={`${lineInputCls} text-sm`}
                  placeholder="SN-1, SN-2…"
                  value={line.serialNumbers ?? ''}
                  onChange={(e) => onPatch(index, { serialNumbers: e.target.value })}
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'serialNumbers')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'taxExemptionReason':
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                <input
                  className={`${lineInputCls} text-sm`}
                  value={line.taxExemptionReason ?? ''}
                  onChange={(e) => onPatch(index, { taxExemptionReason: e.target.value })}
                  {...lineGridDataAttrs(PURCHASE_GRID_ID, index, 'taxExemptionReason')}
                  onKeyDown={(e) => handleLineGridKeyDown(e, handlers)}
                />
              </td>
            );
          case 'rowDelete':
            return (
              <td key={col.id} className={`py-2 px-2 border-x border-[#D6EAF3] ${ERP_PURCHASE_COLUMN_WIDTH.rowDelete ?? ''}`}>
                {readOnly ? null : (
                  <button
                    type="button"
                    onClick={onAppend}
                    className="rounded-md px-1 py-1 text-[#0E78AA] hover:bg-[#E8F4FA]"
                    aria-label="إضافة سطر"
                    title="إضافة سطر"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onPeek(index)}
                  aria-label="فحص الصنف"
                  title="Alt+I"
                >
                  🔍
                </button>
                <button type="button" onClick={() => onRemove(index)} aria-label="حذف">
                  🗑️
                </button>
              </td>
            );
          default:
            return (
              <td key={col.id} className="py-2 px-2 border-x border-[#D6EAF3]">
                —
              </td>
            );
        }
      })}
    </tr>
  );
});

export function ProgressivePurchaseInvoiceLineGrid({
  storageKey,
  lines,
  onChange,
  itemsLoading = false,
  warehouseId,
  visibleColumnIds,
  onVisibleColumnIdsChange,
  modernUi = false,
  inputClassName,
  clipboardItems,
  onClipboardLines,
  pricingCalculationBasis = 'SELECTED_UNIT_QTY',
  readOnly = false,
  lockUnitPrice = false,
  hideAddLine = false,
  landedCostExtras,
  headerDescription = '',
}: Props) {
  const gridContainerRef = useRef<HTMLDivElement>(null);

  useFollowHeaderDescription({
    headerDescription,
    lines,
    onChange,
    getDescription: (line) => line.lineNotes,
    setDescription: (line, value) => ({ ...line, lineNotes: value }),
    disabled: readOnly,
  });

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

  const lineInputCls = inputClassName ?? (modernUi ? erpLineGridInputClass : inputClsBase);
  const [peekIndex, setPeekIndex] = useState<number | null>(null);
  const companyId = getTenantContext().companyId;

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

  const peekLine = peekIndex != null ? lines[peekIndex] : undefined;

  const { data: itemsForBaseUnitResponse } = useItemsQuery();
  const itemsForBaseUnit = useMemo(
    () => itemsForBaseUnitResponse?.data ?? [],
    [itemsForBaseUnitResponse?.data]
  );

  const effectiveColumnIds = useMemo(() => {
    const next = new Set(visibleColumnIds);
    if (storageKey === 'gates:columns:purchase-invoice') next.add('landedCost');
    for (const line of lines) {
      const item = itemsForBaseUnit.find((i) => i.id === line.itemId);
      if (itemIsBatchTracked(item)) next.add('batchAndExpiry');
      if (itemHasApparelVariants(item)) {
        next.add('color');
        next.add('size');
      }
    }
    return INVOICE_LINE_COLUMN_DEFS.filter((c) => next.has(c.id)).map((c) => c.id);
  }, [visibleColumnIds, lines, itemsForBaseUnit, storageKey]);
  const visibleSet = useMemo(() => new Set(effectiveColumnIds), [effectiveColumnIds]);
  const fieldOrder = useMemo(() => buildFocusFieldOrder(effectiveColumnIds), [effectiveColumnIds]);
  const columnDefs = useMemo(
    () => INVOICE_LINE_COLUMN_DEFS.filter((c) => visibleSet.has(c.id)),
    [visibleSet]
  );

  const linesRef = useRef(lines);
  linesRef.current = lines;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const itemsRef = useRef(itemsForBaseUnit);
  itemsRef.current = itemsForBaseUnit;

  const onPatch = useCallback((index: number, patch: Partial<PurchaseInvoiceLine>) => {
    const current = linesRef.current[index];
    if (!current) return;
    let next: Partial<PurchaseInvoiceLine> = { ...patch };
    if (patch.quantity != null || patch.unitId != null || patch.baseQuantity != null) {
      const item = itemsRef.current.find((i) => i.id === (patch.itemId ?? current.itemId));
      const synced = syncLineUnitFields(
        {
          quantity: current.quantity,
          baseQuantity: current.baseQuantity,
          conversionFactor: current.conversionFactor,
          unitId: current.unitId,
          baseUnitId: current.baseUnitId,
        },
        item?.units,
        {
          quantity: patch.quantity,
          unitId: patch.unitId,
          baseQuantity: patch.baseQuantity,
        }
      );
      next = { ...next, ...synced };
    }
    onChangeRef.current(patchLine(linesRef.current, index, next));
  }, []);

  const appendLine = useCallback(() => {
    onChangeRef.current([
      ...linesRef.current,
      {
        itemId: '',
        unitId: '',
        quantity: 1,
        baseQuantity: 1,
        conversionFactor: 1,
        baseUnitId: '',
        unitPrice: 0,
        discount: 0,
        discountValue: 0,
        discountType: 'PERCENTAGE',
        tax: 0,
        warehouseId: warehouseId || '',
      },
    ]);
  }, [warehouseId]);

  useEffect(() => {
    if (readOnly) return;
    if (lines.length === 0) appendLine();
  }, [appendLine, lines.length, readOnly]);

  const removeLine = useCallback((index: number) => {
    onChangeRef.current(linesRef.current.filter((_, i) => i !== index));
  }, []);

  const applyPickedItem = useCallback((index: number, picked: Item | undefined) => {
    if (!picked) return;
    const current = linesRef.current;
    const existing = current[index];
    onChangeRef.current(
      patchLine(current, index, {
        itemId: picked.id,
        unitId: defaultUnitIdForItem(picked),
        barcode: itemBarcodeValue(picked, existing?.barcode ?? ''),
        warehouseId: existing?.warehouseId || warehouseId || '',
        ...syncLineUnitFields(
          { quantity: existing?.quantity || 1, unitId: defaultUnitIdForItem(picked) },
          picked.units
        ),
        unitPrice:
          picked.salesPrice != null && Number(picked.salesPrice) > 0
            ? Number(picked.salesPrice)
            : existing?.unitPrice ?? 0,
        tax:
          picked.defaultTaxPercent != null
            ? Number(picked.defaultTaxPercent)
            : existing?.tax ?? 0,
      })
    );
  }, [warehouseId]);

  const openPeek = useCallback((index: number) => setPeekIndex(index), []);

  const lineGridScrollRef = useRef<HTMLDivElement>(null);
  const virtualizeLines = lines.length >= 40;
  const lineVirtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => lineGridScrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
    enabled: virtualizeLines,
  });
  const visibleLineIndexes = virtualizeLines
    ? lineVirtualizer.getVirtualItems().map((v) => v.index)
    : lines.map((_, i) => i);
  const firstVirtual = virtualizeLines ? lineVirtualizer.getVirtualItems()[0] : undefined;
  const lastVirtual = virtualizeLines ? lineVirtualizer.getVirtualItems().at(-1) : undefined;
  const topSpacer = firstVirtual?.start ?? 0;
  const bottomSpacer =
    virtualizeLines && lastVirtual
      ? Math.max(0, lineVirtualizer.getTotalSize() - lastVirtual.end)
      : 0;

  const colSpan = columnDefs.length;

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
        <table className="w-max min-w-full table-auto text-center border-separate border-spacing-0">
          <thead>
            <tr className={modernUi ? erpTableHeadRowClass : 'bg-[#0E78AA] text-white text-sm'}>
              {columnDefs.map((col) => (
                <th
                  key={col.id}
                  className={`${modernUi ? erpTableHeadCellClass : 'py-3 px-2 font-bold whitespace-nowrap'} ${ERP_PURCHASE_COLUMN_WIDTH[col.id] ?? ''}`}
                >
                  {INVOICE_LINE_COLUMN_DEFS.find((c) => c.id === col.id)?.labelAr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-sm text-[#0A3D5E]">
                  لا توجد أسطر. اضغط «إضافة سطر».
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
                  const line = lines[index];
                  if (!line) return null;
                  return (
                    <PurchaseInvoiceLineRow
                      key={`line-${index}`}
                      index={index}
                      line={line}
                      columnDefs={columnDefs}
                      modernUi={modernUi}
                      lineInputCls={lineInputCls}
                      itemsLoading={itemsLoading}
                      warehouseId={warehouseId}
                      itemsForBaseUnit={itemsForBaseUnit}
                      fieldOrder={fieldOrder}
                      onPatch={onPatch}
                      onPeek={openPeek}
                      onRemove={removeLine}
                      onAppend={appendLine}
                      readOnly={readOnly}
                      applyPickedItem={applyPickedItem}
                      pricingCalculationBasis={pricingCalculationBasis}
                      lockUnitPrice={lockUnitPrice}
                      landedCostExtras={landedCostExtras}
                      allLines={lines}
                    />
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
        {readOnly || hideAddLine ? null : (
          <button
            type="button"
            onClick={appendLine}
            className="mx-3 mt-2 mb-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0E78AA] hover:bg-[#E8F4FA]"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة سطر جديد (Enter)
          </button>
        )}
      </div>

      {peekIndex != null ? (
        <ItemQuickPeekDrawer
          open
          onClose={() => setPeekIndex(null)}
          itemId={peekLine?.itemId?.trim() ? peekLine.itemId : null}
          unitPrice={Number(peekLine?.unitPrice ?? 0)}
        />
      ) : null}
    </>
  );
}
