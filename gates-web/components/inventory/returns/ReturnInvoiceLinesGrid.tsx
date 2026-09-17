'use client';

import {
  ProgressivePurchaseInvoiceLineGrid,
  type PurchaseInvoiceLine,
} from '@/components/inventory/ProgressivePurchaseInvoiceLineGrid';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { mergeVisibleColumnIds } from '@/lib/invoices/invoiceLineColumns';
import { useVisibleColumnIds } from '@/lib/invoices/useVisibleColumnIds';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';

export type ReturnLineForm = {
  itemId: string;
  unitId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  /** H10 fix: the original sold/purchased line this return line reverses. */
  originalInvoiceLineId?: string;
  soldQty?: number;
  returnableQty?: number;
};

type Props = {
  lines: ReturnLineForm[];
  onChange: (lines: ReturnLineForm[]) => void;
  warehouseId?: string;
  lockUnitPrice?: boolean;
  allowAddLines?: boolean;
  headerDescription?: string;
};

export function ReturnInvoiceLinesGrid({
  lines,
  onChange,
  warehouseId,
  lockUnitPrice = false,
  allowAddLines = true,
  headerDescription = '',
}: Props) {
  const [visibleColumnIds, setVisibleColumnIds] = useVisibleColumnIds(
    'gates:columns:purchase-invoice',
    getTenantContext().companyId
  );

  const purchaseLines: PurchaseInvoiceLine[] = lines.map((l) => ({
    ...l,
    tax: l.taxRate ?? 0,
  }));

  const handleChange = (next: PurchaseInvoiceLine[]) => {
    onChange(
      next.map((l, index) => {
        const prev = lines[index];
        return {
          itemId: l.itemId,
          unitId: l.unitId,
          quantity: l.quantity,
          unitPrice: lockUnitPrice && prev?.originalInvoiceLineId ? prev.unitPrice : l.unitPrice,
          discount: l.discount,
          taxRate: l.tax ?? 0,
          costCenterId: l.costCenterId,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate,
          lineNotes: l.lineNotes,
          originalInvoiceLineId: l.originalInvoiceLineId ?? prev?.originalInvoiceLineId,
          soldQty: prev?.soldQty,
          returnableQty: prev?.returnableQty,
        };
      })
    );
  };

  return (
    <FormSectionCard title="بنود المردود" subtitle="الصنف والكمية والسعر" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
      <ProgressivePurchaseInvoiceLineGrid
        storageKey="gates:columns:purchase-invoice"
        lines={purchaseLines}
        onChange={handleChange}
        warehouseId={warehouseId}
        headerDescription={headerDescription}
        visibleColumnIds={visibleColumnIds}
        onVisibleColumnIdsChange={(ids) =>
          setVisibleColumnIds(mergeVisibleColumnIds('gates:columns:purchase-invoice', ids))
        }
        modernUi
        inputClassName={compactControlClass}
        lockUnitPrice={lockUnitPrice}
        hideAddLine={!allowAddLines}
      />
      {lines.some((l) => l.originalInvoiceLineId) ? (
        <ul className="mt-3 space-y-1 text-xs">
          {lines.map((line, index) =>
            line.originalInvoiceLineId ? (
              <li key={`${line.originalInvoiceLineId}-${index}`} className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#E8F4FA] px-2 py-0.5 font-semibold text-[#0E79AA]">
                  المتاح للإرجاع: {line.returnableQty ?? '—'} من أصل {line.soldQty ?? '—'}
                </span>
                {line.returnableQty != null && line.quantity > line.returnableQty + 1e-6 ? (
                  <span className="font-semibold text-rose-600">
                    الكمية تتجاوز المتاح للإرجاع
                  </span>
                ) : null}
              </li>
            ) : null
          )}
        </ul>
      ) : null}
    </FormSectionCard>
  );
}
