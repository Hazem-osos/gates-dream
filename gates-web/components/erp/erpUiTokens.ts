import type { InvoiceLineColumnId } from '@/lib/invoices/invoiceLineColumns';

/** Shared ERP field styling — light theme only (matches legacy Gates forms). */
export const erpLabelClass = 'text-xs font-semibold text-slate-600 mb-1 block';

export const erpInputClass =
  'w-full h-9 min-w-0 px-2.5 text-sm text-gray-700 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] transition-colors duration-200 placeholder:text-slate-400 focus:border-[#0E78AA] focus:ring-2 focus:ring-[#0E78AA]/20 focus:outline-none focus:bg-white';

export const erpInputErrorClass =
  'border-red-500 focus:border-red-500 focus:ring-red-500/30';

export const erpFieldErrorClass = 'text-red-600 text-xs mt-1 block text-right';

export const erpTableHeadRowClass =
  'bg-[#0E78AA] text-white text-xs font-semibold uppercase tracking-wide';

export const erpTableHeadCellClass = 'py-3 px-3 whitespace-nowrap border-e border-white/20 last:border-e-0';

export const erpTableBodyCellClass = 'py-3 px-3 align-top border-b border-[#E8F1F6] border-e border-[#E8F1F6] last:border-e-0';

export const erpLineGridInputClass = `${erpInputClass} h-9 min-h-9`;

export const ERP_SALES_COLUMN_WIDTH: Partial<Record<InvoiceLineColumnId, string>> = {
  rowIndex: 'w-10 min-w-[2.5rem] shrink-0 text-center',
  item: 'min-w-[220px]',
  barcode: 'w-36 min-w-[140px] shrink-0',
  warehouse: 'w-[160px] min-w-[9rem]',
  stockBalance: 'w-24 min-w-[5.5rem] shrink-0 text-center tabular-nums',
  unit: 'w-24 min-w-[5.5rem]',
  baseUnit: 'w-28 min-w-[7rem] text-slate-600',
  baseQuantity: 'w-36 min-w-[140px]',
  quantity: 'w-28 min-w-[100px]',
  unitPrice: 'w-28 min-w-[100px]',
  discount: 'w-36 min-w-[140px]',
  taxRate: 'w-44 min-w-[180px]',
  total: 'w-[120px] min-w-[7rem] shrink-0 font-semibold text-slate-900',
  rowDelete: 'w-12 min-w-[2.75rem] shrink-0',
  costCenter: 'w-36 min-w-[140px]',
  lineAccount: 'min-w-[180px]',
  withholdingTax: 'w-44 min-w-[180px]',
  color: 'w-28 min-w-[6.5rem]',
  size: 'w-24 min-w-[5.5rem]',
  batchAndExpiry: 'min-w-[180px]',
  batchNumber: 'w-32 min-w-[120px]',
  expiryDate: 'w-36 min-w-[140px]',
  notes: 'min-w-[160px]',
  productionDate: 'w-36 min-w-[140px]',
  serialNumbers: 'min-w-[160px]',
  taxExemptionReason: 'min-w-[160px]',
  freeBonus: 'w-24 min-w-[5.5rem] shrink-0',
  unitConversion: 'w-28 min-w-[100px]',
};

export const ERP_PURCHASE_COLUMN_WIDTH: Partial<Record<InvoiceLineColumnId, string>> = {
  ...ERP_SALES_COLUMN_WIDTH,
  unitPrice: 'w-[110px]',
  landedCost: 'w-[140px] min-w-[132px]',
};

export const SALES_INVOICE_DEFAULT_COLUMN_IDS: InvoiceLineColumnId[] = [
  'rowIndex',
  'item',
  'warehouse',
  'unit',
  'baseUnit',
  'quantity',
  'unitPrice',
  'discount',
  'taxRate',
  'total',
  'rowDelete',
];

/** Invoice documents fill the main pane; extra columns scroll inside the grid. */
export const ERP_INVOICE_DOCUMENT_LAYOUT_CLASS = 'erp-contain';

/** Items card: tall enough for several rows and customize-columns tables. */
export const ERP_INVOICE_ITEMS_CARD_CLASS =
  'flex min-h-[min(380px,42vh)] min-w-0 w-full max-w-full flex-col';

export const ERP_INVOICE_ITEMS_TABLE_WRAP_CLASS =
  'erp-scroll-x min-h-[220px] flex-1';

export const PURCHASE_INVOICE_DEFAULT_COLUMN_IDS: InvoiceLineColumnId[] = [
  'rowIndex',
  'item',
  'warehouse',
  'unit',
  'baseUnit',
  'quantity',
  'unitPrice',
  'landedCost',
  'discount',
  'taxRate',
  'total',
  'rowDelete',
];
