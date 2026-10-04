import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';

export type PosPostingContext = JournalPostingContext;

export type PosPaymentMethod = 'CASH' | 'CARD' | 'CREDIT' | 'SPLIT';

export type PosOrderStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export type PosShiftStatus = 'OPEN' | 'CLOSED';

export interface PosOrderLineInput {
  itemId: string;
  unitId: string;
  quantity: number;
  price: number;
  /** Resolved catalog price before a permitted override. */
  listPrice?: number;
  /** H12 fix: POS lines can now discount by percent, matching invoice lines. */
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  lineOrder: number;
  notes?: string | null;
  originalLineId?: string | null;
  isGift?: boolean;
  offerId?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  serialNo?: string | null;
}

export interface CreatePosOrderInput {
  orderNumber: string;
  orderType?: 'SALE' | 'RETURN' | 'QUOTE' | 'RESERVATION';
  couponCode?: string;
  quoteName?: string;
  expiresAt?: string;
  originalOrderId?: string;
  customerId?: string;
  notes?: string;
  headerDiscountPercent?: number;
  clientRequestId?: string;
  approvalId?: string;
  paymentMethod?: PosPaymentMethod;
  cashAmount?: number;
  cardAmount?: number;
  creditAmount?: number;
  currencyCode?: string;
  lines: Array<PosOrderLineInput & { notes?: string | null }>;
}

export interface ZReportSummary {
  shiftId: string;
  openingCash: number;
  closingCashSystem: number;
  closingCashDeclared: number;
  cashVariance: number;
  totalCashSales: number;
  totalCardSales: number;
  totalCreditSales: number;
  totalMerchandise: number;
  totalTaxAmount: number;
  totalCogs: number;
  orderCount: number;
}
