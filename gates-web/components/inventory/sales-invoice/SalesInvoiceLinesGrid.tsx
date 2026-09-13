'use client';

import type { ComponentProps } from 'react';
import { ProgressiveSalesInvoiceLineGrid } from '@/components/inventory/ProgressiveSalesInvoiceLineGrid';

export { SALES_INVOICE_DEFAULT_COLUMN_IDS as SALES_INVOICE_STANDARD_COLUMNS } from '@/components/inventory/sales-invoice/erpUiTokens';

type GridProps = ComponentProps<typeof ProgressiveSalesInvoiceLineGrid>;

export function SalesInvoiceLinesGrid(props: GridProps) {
  return (
    <div data-tour="items-grid" data-tour-legacy="invoice-items-grid" data-tour-foundation="invoice-line-grid">
      <ProgressiveSalesInvoiceLineGrid modernUi {...props} />
    </div>
  );
}
