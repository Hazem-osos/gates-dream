import { roundTo4 } from '../../../shared/utils/decimal-round';

export interface PurchaseLineNetInput {
  total: unknown;
  discountAmount?: unknown;
  headerDiscountAllocated?: unknown;
  quantity?: unknown;
  baseQuantity?: unknown;
}

export interface PurchaseLineNetCost {
  qty: number;
  lineDiscount: number;
  headerDiscount: number;
  /** Document-currency merchandise after line + allocated header discount. */
  lineNetDoc: number;
  /** Base-currency merchandise (lineNetDoc × FX). */
  lineNetTotalBase: number;
  /** Base-currency moving-average inbound cost (lineNetTotalBase / qty). */
  unifiedNetUnitCost: number;
}

/**
 * Single net-of-discount unit cost used by both purchase MAC inbound and
 * the inventory GL debit so valuation and the ledger cannot drift.
 */
export function computePurchaseLineNetCost(
  line: PurchaseLineNetInput,
  fxRate = 1
): PurchaseLineNetCost {
  const qty = Number(line.baseQuantity ?? line.quantity) || 0;
  const lineDiscount = Number(line.discountAmount || 0);
  const headerDiscount = Number(line.headerDiscountAllocated || 0);
  const lineNetDoc = roundTo4(Number(line.total) - lineDiscount - headerDiscount);
  const rate = Number(fxRate) || 1;
  const lineNetTotalBase = roundTo4(lineNetDoc * rate);
  const unifiedNetUnitCost = qty > 0 ? roundTo4(lineNetTotalBase / qty) : 0;
  return {
    qty,
    lineDiscount,
    headerDiscount,
    lineNetDoc,
    lineNetTotalBase,
    unifiedNetUnitCost,
  };
}
