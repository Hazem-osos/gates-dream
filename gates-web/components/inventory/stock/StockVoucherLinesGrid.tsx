'use client';

import { Plus, Trash2 } from 'lucide-react';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { InvoiceLineStockBalanceCell } from '@/components/invoices/InvoiceLineStockBalanceCell';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import { Button, IconButton } from '@/components/ui';
import {
  ERP_INVOICE_ITEMS_TABLE_WRAP_CLASS,
  erpLineGridInputClass,
  erpLineGridNumericInputClass,
  erpTableBodyCellClass,
  erpTableHeadCellClass,
  erpTableHeadRowClass,
  erpTableNumCellClass,
  erpTableNumHeadClass,
} from '@/components/erp/erpUiTokens';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { useItemsQuery } from '@/lib/hooks/useMasterDataQueries';
import { BatchExpiryLineTrigger } from '@/components/invoices/BatchExpiryLineTrigger';
import { itemUsesExpiryDate } from '@/lib/invoices/itemTracking';
import type { InvoiceLineBatchAllocation } from '@/lib/invoices/invoiceLineColumns';
import { resolveWarehouseAverageUnitCost } from '@/lib/inventory/assembly-pricing';

export type StockVoucherLine = {
  itemId: string;
  locationId?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
  itemReservationId?: string;
  reservationFulfillQuantity?: number;
  reservationLabel?: string;
  batchNumber?: string;
  expiryDate?: string;
  batchAllocations?: InvoiceLineBatchAllocation[];
};

export function blankStockVoucherLine(): StockVoucherLine {
  return {
    itemId: '',
    locationId: '',
    quantity: 0,
    unitPrice: 0,
    total: 0,
    itemReservationId: '',
    reservationFulfillQuantity: 0,
    reservationLabel: '',
  };
}

export function seedStockVoucherLines(count = 4): StockVoucherLine[] {
  return Array.from({ length: count }, () => blankStockVoucherLine());
}

type Props = {
  lines: StockVoucherLine[];
  warehouseId?: string;
  asOfDate?: string;
  hideExistingQty?: boolean;
  priceLabel: string;
  readOnly?: boolean;
  /** When true, unit price follows warehouse average cost and cannot be edited. */
  lockUnitPrice?: boolean;
  itemsLoading?: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof StockVoucherLine, value: string | number) => void;
  onPatchLine?: (index: number, patch: Partial<StockVoucherLine>) => void;
};

export function StockVoucherLinesGrid({
  lines,
  warehouseId,
  asOfDate,
  hideExistingQty,
  priceLabel,
  readOnly,
  lockUnitPrice = false,
  itemsLoading,
  onAdd,
  onRemove,
  onChange,
  onPatchLine,
}: Props) {
  const { data: itemsRes } = useItemsQuery(800);
  const catalogItems = itemsRes?.data ?? [];
  const totalAmount = lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);

  return (
    <div className="space-y-3">
      {readOnly ? null : (
        <div className="flex items-center justify-end">
          <Button type="button" variant="primary" className="gap-2" onClick={onAdd}>
            <Plus className="h-4 w-4" aria-hidden />
            سطر جديد
          </Button>
        </div>
      )}
      <div className={ERP_INVOICE_ITEMS_TABLE_WRAP_CLASS}>
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className={erpTableHeadRowClass}>
              <th className={`${erpTableHeadCellClass} w-12 text-center`}>#</th>
              <th className={`${erpTableHeadCellClass} min-w-[220px] text-right`}>الصنف</th>
              {hideExistingQty ? null : (
                <th className={`${erpTableHeadCellClass} w-28 text-center`}>المتاح</th>
              )}
              <th className={erpTableNumHeadClass}>الكمية</th>
              <th className={erpTableNumHeadClass}>{priceLabel}</th>
              <th className={erpTableNumHeadClass}>الإجمالي</th>
              {readOnly ? null : <th className={`${erpTableHeadCellClass} w-14`} />}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`stock-line-${index}`} className="bg-white">
                <td className={`${erpTableBodyCellClass} text-center text-slate-500`}>{index + 1}</td>
                <td className={erpTableBodyCellClass}>
                  <div className="flex items-center gap-1">
                    <ItemSelect
                      className={`${erpLineGridInputClass} min-w-0 flex-1`}
                      value={line.itemId}
                      warehouseId={warehouseId}
                      onChange={(id) => onChange(index, 'itemId', id)}
                      disabled={itemsLoading || readOnly}
                      onItemResolved={(item) => {
                        if (!lockUnitPrice || !item || !('id' in item)) return;
                        const catalog = item as ItemOption;
                        void resolveWarehouseAverageUnitCost(
                          catalog.id,
                          warehouseId,
                          catalog,
                          asOfDate
                        ).then((unitPrice) => {
                          onChange(index, 'unitPrice', unitPrice);
                        });
                      }}
                    />
                    {warehouseId && line.itemId && itemUsesExpiryDate(catalogItems.find((i) => i.id === line.itemId)) ? (
                      <BatchExpiryLineTrigger
                        mode="issue"
                        item={catalogItems.find((i) => i.id === line.itemId)}
                        itemId={line.itemId}
                        warehouseId={warehouseId}
                        quantity={Number(line.quantity) || 0}
                        batchNumber={line.batchNumber}
                        expiryDate={line.expiryDate}
                        allocations={line.batchAllocations}
                        readOnly={readOnly}
                        onChange={(patch) => onPatchLine?.(index, patch)}
                      />
                    ) : null}
                  </div>
                </td>
                {hideExistingQty ? null : (
                  <td className={`${erpTableBodyCellClass} text-center`}>
                    {warehouseId && line.itemId ? (
                      <InvoiceLineStockBalanceCell itemId={line.itemId} warehouseId={warehouseId} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                )}
                <td className={erpTableBodyCellClass}>
                  <TableNumberInput
                    className={erpLineGridNumericInputClass}
                    value={line.quantity}
                    disabled={readOnly}
                    onValueCommit={(n) => onChange(index, 'quantity', n)}
                  />
                </td>
                <td className={erpTableBodyCellClass}>
                  <TableNumberInput
                    className={`${erpLineGridNumericInputClass}${lockUnitPrice ? ' bg-slate-50 text-slate-600' : ''}`}
                    value={line.unitPrice}
                    disabled={readOnly || lockUnitPrice}
                    title={lockUnitPrice ? 'متوسط التكلفة — لا يمكن التعديل' : undefined}
                    onValueCommit={(n) => onChange(index, 'unitPrice', n)}
                  />
                </td>
                <td className={erpTableNumCellClass}>
                  {formatInvoiceMoney(Number(line.total) || 0)}
                </td>
                {readOnly ? null : (
                  <td className={`${erpTableBodyCellClass} text-center`}>
                    <IconButton
                      icon={Trash2}
                      label="حذف السطر"
                      variant="danger"
                      onClick={() => onRemove(index)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#F6FBFD]">
              <td
                className={`${erpTableBodyCellClass} font-semibold text-[#0A3D5E]`}
                colSpan={hideExistingQty ? 4 : 5}
              >
                الإجمالي
              </td>
              <td className={`${erpTableBodyCellClass} text-center font-bold tabular-nums text-[#0E78AA]`}>
                {formatInvoiceMoney(totalAmount)}
              </td>
              {readOnly ? null : <td className={erpTableBodyCellClass} />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
