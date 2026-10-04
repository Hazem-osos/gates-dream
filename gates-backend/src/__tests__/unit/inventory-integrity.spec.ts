import {
  classifyInventoryTriple,
  classifyValuationGap,
  inventoryTripleKey,
  openingImportIdentity,
  openingImportLookup,
  planUnlocatedQuantitySync,
  shouldSeedDemoOpening,
} from '../../modules/inventory/services/inventory-integrity';

const base = {
  companyId: 'co-1',
  itemId: 'item-1',
  warehouseId: 'wh-1',
  locationQty: 10,
  warehouseOnHand: 10,
  movementQty: 10,
  nullLocationRowCount: 1,
  warehouseAverageCost: 25,
};

describe('inventory integrity classification', () => {
  it('marks a triple in sync when location, balance, and ledger agree', () => {
    expect(classifyInventoryTriple(base)).toEqual(['IN_SYNC']);
  });

  it('classifies balance copied without a ledger (historical backfill)', () => {
    expect(
      classifyInventoryTriple({ ...base, locationQty: 8, warehouseOnHand: 8, movementQty: 0 })
    ).toEqual(expect.arrayContaining(['BALANCE_WITHOUT_LEDGER', 'LOCATION_LEDGER_DRIFT']));
  });

  it('classifies a location-only quantity (import/demo that skipped the ledger)', () => {
    expect(
      classifyInventoryTriple({ ...base, locationQty: 5, warehouseOnHand: 0, movementQty: 0, warehouseAverageCost: 0 })
    ).toEqual(expect.arrayContaining(['LOCATION_WITHOUT_BALANCE', 'LOCATION_LEDGER_DRIFT']));
  });

  it('flags duplicate NULL location rows without treating them as in sync', () => {
    const classes = classifyInventoryTriple({ ...base, nullLocationRowCount: 2 });
    expect(classes).toContain('DUPLICATE_NULL_LOCATION');
    expect(classes).not.toContain('IN_SYNC');
  });

  it('flags on-hand stock whose warehouse average cost is missing', () => {
    expect(classifyInventoryTriple({ ...base, warehouseAverageCost: 0 })).toContain(
      'ON_HAND_WITHOUT_WAREHOUSE_COST'
    );
  });

  it('keeps two companies apart when the item and warehouse ids match', () => {
    expect(inventoryTripleKey('co-a', 'item', 'wh')).not.toBe(inventoryTripleKey('co-b', 'item', 'wh'));
  });

  it('reports a GL gap without implying either side should be rewritten', () => {
    expect(classifyValuationGap(100, 100)).toBe('GL_MATCHES_STOCK_VALUE');
    expect(classifyValuationGap(100, 40)).toBe('GL_STOCK_VALUE_GAP');
  });
});

describe('opening import and demo guards', () => {
  it('matches a barcode as a barcode, not as a serial, and ignores the name when a code exists', () => {
    const identity = openingImportIdentity({
      barcode: ' 6281 ',
      arabicName: 'صنف',
      quantity: '4',
      purchasePrice: 12,
    });
    expect(identity.serial).toBe('');
    expect(identity.barcode).toBe('6281');
    expect(openingImportLookup(identity)).toEqual({ kind: 'codes', barcode: '6281' });
  });

  it('uses the name only when serial and barcode are both absent', () => {
    expect(openingImportLookup(openingImportIdentity({ name: 'سكر', qty: 2 }))).toEqual({
      kind: 'name',
      name: 'سكر',
    });
  });

  it('skips a non-positive opening quantity', () => {
    expect(openingImportLookup(openingImportIdentity({ serial: 'A', name: 'صنف', qty: 0 }))).toEqual({
      kind: 'skip',
    });
  });

  it('seeds a demo opening only when neither a location row nor a movement exists', () => {
    expect(shouldSeedDemoOpening(false, false)).toBe(true);
    expect(shouldSeedDemoOpening(true, false)).toBe(false);
    expect(shouldSeedDemoOpening(false, true)).toBe(false);
  });
});

describe('unlocated quantity sync plan', () => {
  it('updates the single unlocated row to the ledger quantity', () => {
    expect(planUnlocatedQuantitySync({ locatedRowCount: 0, nullLocationRowCount: 1, ledgerQty: 7 })).toEqual({
      action: 'update',
      quantity: 7,
    });
  });

  it('creates a row only when the ledger has quantity and no location rows exist', () => {
    expect(planUnlocatedQuantitySync({ locatedRowCount: 0, nullLocationRowCount: 0, ledgerQty: 3 })).toEqual({
      action: 'create',
      quantity: 3,
    });
  });

  it('does not rewrite located stock or duplicate NULL rows', () => {
    expect(planUnlocatedQuantitySync({ locatedRowCount: 2, nullLocationRowCount: 1, ledgerQty: 9 })).toEqual({
      action: 'skip',
      reason: 'located-rows',
    });
    expect(planUnlocatedQuantitySync({ locatedRowCount: 0, nullLocationRowCount: 3, ledgerQty: 9 })).toEqual({
      action: 'skip',
      reason: 'duplicate-null-location',
    });
  });
});
