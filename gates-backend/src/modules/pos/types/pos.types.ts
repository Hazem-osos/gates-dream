import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';

export type PosPostingContext = JournalPostingContext;

export type PosPaymentMethod = 'CASH' | 'CARD' | 'CREDIT' | 'SPLIT';

export type PosOrderStatus = 'DRAFT' | 'POSTED' | 'VOID';

export type PosShiftStatus = 'OPEN' | 'CLOSED';

export interface PosOrderLineInput {
  itemId: string;
  unitId: string;
  quantity: number;
  price: number;
  /** H12 fix: POS lines can now discount by percent, matching invoice lines. */
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  lineOrder: number;
}

export interface CreatePosOrderInput {
  orderNumber: string;
  orderType?: 'SALE' | 'RETURN';
  originalOrderId?: string;
  customerId?: string;
  paymentMethod: PosPaymentMethod;
  cashAmount?: number;
  cardAmount?: number;
  creditAmount?: number;
  currencyCode?: string;
  lines: PosOrderLineInput[];
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
