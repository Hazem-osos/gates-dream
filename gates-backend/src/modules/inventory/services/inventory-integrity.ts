/** Read-only classification of inventory quantity/cost drift. Never writes. */

export const INVENTORY_QTY_TOLERANCE = 0.0001;

export type InventoryMismatchClass =
  | 'IN_SYNC'
  | 'BALANCE_WITHOUT_LEDGER'
  | 'LEDGER_WITHOUT_BALANCE'
  | 'LOCATION_WITHOUT_BALANCE'
  | 'BALANCE_LOCATION_DRIFT'
  | 'BALANCE_LEDGER_DRIFT'
  | 'LOCATION_LEDGER_DRIFT'
  | 'DUPLICATE_NULL_LOCATION'
  | 'ON_HAND_WITHOUT_WAREHOUSE_COST';

export type ValuationGapClass = 'GL_MATCHES_STOCK_VALUE' | 'GL_STOCK_VALUE_GAP';

export type UnlocatedSyncPlan =
  | { action: 'skip'; reason: 'located-rows' | 'duplicate-null-location' }
  | { action: 'noop' }
  | { action: 'create'; quantity: number }
  | { action: 'update'; quantity: number };

export interface InventoryTripleInput {
  companyId: string;
  itemId: string;
  warehouseId: string;
  locationQty: number;
  warehouseOnHand: number;
  movementQty: number;
  nullLocationRowCount: number;
  warehouseAverageCost: number | null;
}

function apart(a: number, b: number): boolean {
  return Math.abs(a - b) > INVENTORY_QTY_TOLERANCE;
}

function present(value: number): boolean {
  return Math.abs(value) > INVENTORY_QTY_TOLERANCE;
}

export function inventoryTripleKey(companyId: string, itemId: string, warehouseId: string): string {
  return `${companyId}|${itemId}|${warehouseId}`;
}

/**
 * Classify one company+item+warehouse triple.
 * A gap is reported; nothing here rewrites balances or journals.
 */
export function classifyInventoryTriple(input: InventoryTripleInput): InventoryMismatchClass[] {
  const classes: InventoryMismatchClass[] = [];
  const location = input.locationQty;
  const balance = input.warehouseOnHand;
  const ledger = input.movementQty;

  if (input.nullLocationRowCount > 1) classes.push('DUPLICATE_NULL_LOCATION');
  if (apart(balance, ledger)) {
    if (!present(ledger) && present(balance)) classes.push('BALANCE_WITHOUT_LEDGER');
    else if (present(ledger) && !present(balance)) classes.push('LEDGER_WITHOUT_BALANCE');
    else classes.push('BALANCE_LEDGER_DRIFT');
  }
  if (apart(balance, location)) {
    if (!present(balance) && present(location)) classes.push('LOCATION_WITHOUT_BALANCE');
    else classes.push('BALANCE_LOCATION_DRIFT');
  }
  if (apart(location, ledger)) classes.push('LOCATION_LEDGER_DRIFT');
  const costMissing =
    present(balance) &&
    (input.warehouseAverageCost == null || Math.abs(input.warehouseAverageCost) <= INVENTORY_QTY_TOLERANCE);
  if (costMissing) classes.push('ON_HAND_WITHOUT_WAREHOUSE_COST');
  if (classes.length === 0) classes.push('IN_SYNC');
  return classes;
}

/** GL vs stock value is informational. Neither side is rewritten to match the other. */
export function classifyValuationGap(stockValue: number, glNet: number): ValuationGapClass {
  return apart(stockValue, glNet) ? 'GL_STOCK_VALUE_GAP' : 'GL_MATCHES_STOCK_VALUE';
}

/**
 * Explicit cost-repair helper. Aligns the single unlocated quantity row to the
 * movement replay. Refuses when locations exist or NULL-location rows are duplicated,
 * so ambiguous production rows are left for the read-only report.
 */
export function planUnlocatedQuantitySync(input: {
  locatedRowCount: number;
  nullLocationRowCount: number;
  ledgerQty: number;
}): UnlocatedSyncPlan {
  if (input.locatedRowCount > 0) return { action: 'skip', reason: 'located-rows' };
  if (input.nullLocationRowCount > 1) return { action: 'skip', reason: 'duplicate-null-location' };
  if (input.nullLocationRowCount === 1) return { action: 'update', quantity: input.ledgerQty };
  if (present(input.ledgerQty)) return { action: 'create', quantity: input.ledgerQty };
  return { action: 'noop' };
}

export interface OpeningImportIdentity {
  serial: string;
  barcode: string;
  name: string;
  qty: number;
  unitCost: number;
}

/** Opening import matches serial→serial and barcode→barcode. A name match is used only when both codes are absent. */
export function openingImportIdentity(row: Record<string, unknown>): OpeningImportIdentity {
  const serial = String(row.serial ?? row.code ?? '').trim();
  const barcode = row.barcode != null ? String(row.barcode).trim() : '';
  const name = String(row.arabicName ?? row.name ?? '').trim();
  const qty = Number(row.quantity ?? row.qty ?? row.openingQty ?? 0);
  const purchase = Number(row.purchasePrice);
  const price = Number(row.price);
  const unitCost = Number.isFinite(purchase) && purchase > 0 ? purchase : Number.isFinite(price) && price > 0 ? price : 0;
  return {
    serial,
    barcode,
    name,
    qty: Number.isFinite(qty) ? qty : 0,
    unitCost,
  };
}

export type OpeningImportLookup =
  | { kind: 'skip' }
  | { kind: 'codes'; serial?: string; barcode?: string }
  | { kind: 'name'; name: string };

export function openingImportLookup(identity: OpeningImportIdentity): OpeningImportLookup {
  if (!identity.name || identity.qty <= 0) return { kind: 'skip' };
  if (identity.serial || identity.barcode) {
    return {
      kind: 'codes',
      ...(identity.serial ? { serial: identity.serial } : {}),
      ...(identity.barcode ? { barcode: identity.barcode } : {}),
    };
  }
  return { kind: 'name', name: identity.name };
}

/** New demo opening stock is posted only when neither a location row nor a ledger row exists. Existing drift is left untouched. */
export function shouldSeedDemoOpening(existingLocationRow: boolean, existingMovement: boolean): boolean {
  return !existingLocationRow && !existingMovement;
}
