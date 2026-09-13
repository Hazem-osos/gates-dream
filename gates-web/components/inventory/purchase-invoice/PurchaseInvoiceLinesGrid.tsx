'use client';

import type { ComponentProps } from 'react';
import { ProgressivePurchaseInvoiceLineGrid } from '@/components/inventory/ProgressivePurchaseInvoiceLineGrid';

export { PURCHASE_INVOICE_DEFAULT_COLUMN_IDS as PURCHASE_INVOICE_STANDARD_COLUMNS } from '@/components/erp/erpUiTokens';

type GridProps = ComponentProps<typeof ProgressivePurchaseInvoiceLineGrid>;

export function PurchaseInvoiceLinesGrid(props: GridProps) {
  return (
    <div data-tour="items-grid">
      <ProgressivePurchaseInvoiceLineGrid modernUi {...props} />
    </div>
  );
}
