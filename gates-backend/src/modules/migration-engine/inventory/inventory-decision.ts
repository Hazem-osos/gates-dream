import { money } from '../accounting/journal-money';
import { legacyTrim } from '../transforms/legacy-values';

export type InventoryMovementDecision =
  | 'IMPORT'
  | 'SKIP_UNPOSTED'
  | 'SKIP_DELETED'
  | 'SKIP_NO_STOCK'
  | 'SKIP_ALREADY_MAPPED'
  | 'SKIP_GROUP_ITEM'
  | 'QUARANTINE_MISSING_ITEM'
  | 'QUARANTINE_MISSING_WAREHOUSE'
  | 'QUARANTINE_UNKNOWN_TYPE'
  | 'QUARANTINE_INVALID_FACTOR';

const INVOICE_STOCK_SIGN: Record<string, number> = {
  PI01: 1,
  PI02: 1,
  SI01: -1,
  SI02: -1,
  PR01: -1,
  PR02: -1,
  SV01: -1,
  SV03: -1,
  SV99: -1,
  SR01: 1,
  SR99: 1,
};

export function invoiceStockSign(type: string): number | null {
  const key = legacyTrim(type).toUpperCase();
  return key in INVOICE_STOCK_SIGN ? INVOICE_STOCK_SIGN[key] : null;
}

/**
 * Every non-group item row is migrated as an item. Deleted items are kept (inactive): posted
 * history may reference them, and dropping them would orphan those invoice lines. Types other
 * than D (e.g. services) are still items.
 */
export function isLegacyStockItem(row: { ItemType?: unknown; HasChild?: unknown; Deleted?: unknown }): boolean {
  return !isLegacyItemGroup(row);
}

export function isLegacyItemGroup(row: { ItemType?: unknown; HasChild?: unknown }): boolean {
  const type = legacyTrim(row.ItemType).toUpperCase();
  const hasChild = legacyTrim(row.HasChild).toUpperCase() === 'T';
  return type === 'C' || hasChild;
}

export function baseQuantity(qty1: unknown, qty2: unknown) {
  const q2 = money(qty2);
  if (!q2.isZero()) return q2;
  return money(qty1);
}

export function transferQuantity(transMainQty: unknown, transQty: unknown, qty: unknown) {
  const main = money(transMainQty);
  if (!main.isZero()) return main.abs();
  const tq = money(transQty);
  if (!tq.isZero()) return tq.abs();
  return money(qty).abs();
}

export function conversionFactor(change: unknown) {
  const factor = money(change ?? 1);
  return factor.lte(0) ? money(0) : factor;
}

export type WarehouseEvidence = 'VERIFIED' | 'AMBIGUOUS' | 'UNRESOLVABLE';

/** Line store, then header store. Never a majority/default warehouse. */
export function resolveLegacyInvoiceWarehouse(
  lineStore: unknown,
  headerStore: unknown
): { warehouseCode: string; classification: WarehouseEvidence } {
  const line = legacyTrim(lineStore);
  if (line) return { warehouseCode: line, classification: 'VERIFIED' };
  const header = legacyTrim(headerStore);
  if (header) return { warehouseCode: header, classification: 'VERIFIED' };
  return { warehouseCode: '', classification: 'UNRESOLVABLE' };
}

/** Posted purchase CostPrice is source evidence. Sales CostPrice is not inventory cost. */
export function isDefensiblePurchaseCost(type: string, costPrice: unknown): boolean {
  return legacyTrim(type).toUpperCase() === 'PI01' && money(costPrice).gt(0);
}

export function decidePostedStockDocument(params: {
  isPosted: boolean;
  isDeleted: boolean;
  alreadyMapped: boolean;
  affectStore?: boolean;
  itemResolved: boolean;
  warehouseResolved: boolean;
  typeKnown: boolean;
  factorOk: boolean;
}): { decision: InventoryMovementDecision; reason: string } {
  if (params.alreadyMapped) return { decision: 'SKIP_ALREADY_MAPPED', reason: 'Id map already has this movement' };
  if (params.isDeleted) return { decision: 'SKIP_DELETED', reason: 'Legacy header Deleted=T' };
  if (!params.isPosted) return { decision: 'SKIP_UNPOSTED', reason: 'Posted-only historical stock import' };
  if (params.affectStore === false) return { decision: 'SKIP_NO_STOCK', reason: 'AffectStore is not T' };
  if (!params.factorOk) return { decision: 'QUARANTINE_INVALID_FACTOR', reason: 'Conversion factor is missing or <= 0' };
  if (!params.typeKnown) return { decision: 'QUARANTINE_UNKNOWN_TYPE', reason: 'No stock sign mapping for this document type' };
  if (!params.itemResolved) return { decision: 'QUARANTINE_MISSING_ITEM', reason: 'Item code is not mapped' };
  if (!params.warehouseResolved) {
    return { decision: 'QUARANTINE_MISSING_WAREHOUSE', reason: 'Warehouse/store code is missing or unmapped' };
  }
  return { decision: 'IMPORT', reason: 'Posted stock-affecting movement with resolved item and warehouse' };
}
