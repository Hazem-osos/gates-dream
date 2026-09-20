/**
 * Shared DTOs for inventory transactional screens (Sprint 2).
 */
import type { SalesInvoiceFormValues } from '@/lib/validation/inventory.schema';

/** Single line on sales / purchase invoice forms and API payloads. */
export type InvoiceLineItem = SalesInvoiceFormValues['lines'][number];

/** Row shape for warehouse movement grids (issue, receipt, transfer, adjustment). */
export type StockMovementRow = {
  id?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  unitId?: string;
  quantity: number | string;
  warehouseId?: string;
  cost?: number | string;
  notes?: string;
};

/** Item card create/update payload (subset of full item API model). */
export type ItemCardDto = {
  id?: string;
  serial?: string;
  arabicName: string;
  englishName?: string;
  mainAccountId?: string;
  costCenterId?: string;
  orderLimit?: number | string;
  beginningBalance?: number | string;
  beginningCostPrice?: number | string;
};

/** Loaded sales invoice header + lines from GET /invoices/:id */
export type SalesInvoiceDetail = {
  id: string;
  invoiceNumber?: string | null;
  isPosted?: boolean;
  isApproved?: boolean;
  isCancelled?: boolean;
  isSalesTaxInvoice?: boolean;
  customerId?: string | null;
  date?: string | null;
  paymentMethod?: string | null;
  paymentType?: string | null;
  warehouseId?: string | null;
  description?: string | null;
  hijriDate?: string | null;
  currencyId?: string | null;
  costCenterId?: string | null;
  allowReturn?: boolean | null;
  returnDays?: number | null;
  withholdingTaxAmount?: number | string | null;
  developmentFeeRate?: number | string | null;
  developmentFeeAmount?: number | string | null;
  createdAt?: string | null;
  postedAt?: string | null;
  /** Wave 5 fix: optimistic-lock counter — echoed back as `expectedVersion` on save. */
  version?: number | null;
  /** Sales Invoice Enterprise Redesign additions. */
  dueDate?: string | null;
  exchangeRate?: number | string | null;
  representativeId?: string | null;
  driverId?: string | null;
  distributorId?: string | null;
  sellerId?: string | null;
  taxTreatmentType?: string | null;
  isDelivered?: boolean | null;
  handoverDate?: string | null;
  convertedFromInvoice?: {
    id: string;
    invoiceNumber?: string | null;
    invoiceKind?: string | null;
    date?: string | null;
  } | null;
  lines?: Array<Record<string, unknown>>;
  adjustments?: Array<{
    id?: string;
    type: 'ADDITION' | 'DEDUCTION';
    calcType: 'FIXED' | 'PERCENTAGE';
    rate?: number | string | null;
    amount: number | string;
    description?: string | null;
    currency?: string | null;
    exchangeRate?: number | string | null;
    accountId: string;
    offsetAccountId?: string | null;
    costCenterId?: string | null;
  }>;
};

/** API line payload when hydrating warehouse documents */
export type WarehouseDocLinePayload = Record<string, unknown>;
