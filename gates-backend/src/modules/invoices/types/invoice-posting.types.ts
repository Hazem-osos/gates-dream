import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';

export type InvoiceKind =
  | 'PURCHASE'
  | 'SALE'
  | 'PURCHASE_RETURN'
  | 'SALE_RETURN';

export interface InvoicePostingContext extends JournalPostingContext {
  fiscalYearId: string;
}

export interface InvoiceLineTotals {
  /** Net of ALL discounts (line + header) — what actually hits AR/inventory. */
  merchandise: number;
  /** M7 fix: total discount (line + header), broken out so SALE/SALE_RETURN
   * can post it to a visible contra-revenue account instead of netting it
   * silently into the revenue credit. */
  discount: number;
  tax: number;
  /** رسم التنمية — يُضاف للإجمالي ولا يُدمج في VAT. */
  developmentFee: number;
  net: number;
  cogs: number;
}

export interface ResolvedPostingAccounts {
  partyAccountId: string;
  inventoryAccountId: string;
  revenueAccountId: string;
  cogsAccountId: string;
  vatOutputAccountId?: string;
  vatInputAccountId?: string;
  withholdingAccountId?: string;
  whtReceivableAccountId?: string;
  /** M7 fix: required only when kind is SALE/SALE_RETURN and discount > 0. */
  salesDiscountAccountId?: string;
  /** Periodic inventory: credit purchase-returns instead of inventory. */
  purchaseReturnAccountId?: string;
}
