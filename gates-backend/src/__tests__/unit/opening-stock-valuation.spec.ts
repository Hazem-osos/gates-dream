import {
  duplicateOpeningStockLine,
  openingLinesWithoutWarehouseOverlap,
  openingStockInventoryStillApplied,
} from '../../modules/inventory/services/opening-stock-valuation';

describe('openingStockInventoryStillApplied', () => {
  it('draft documents do not affect warehouse stock', () => {
    expect(
      openingStockInventoryStillApplied({
        isCancelled: false,
        isPosted: false,
        journalEntryId: null,
      })
    ).toBe(false);
  });

  it('posted documents keep stock live until unposted', () => {
    expect(
      openingStockInventoryStillApplied({
        isCancelled: false,
        isPosted: true,
        journalEntryId: 'je-opening',
      })
    ).toBe(true);
  });
});

describe('opening stock per warehouse', () => {
  it('keeps every warehouse once and prefers the posted document', () => {
    const kept = openingLinesWithoutWarehouseOverlap([
      {
        id: 'draft-a',
        isPosted: false,
        updatedAt: '2026-10-02T00:00:00.000Z',
        lines: [{ warehouseId: 'wh-a', itemId: 'item-1', quantity: 5, unitPrice: 10 }],
      },
      {
        id: 'posted-a',
        isPosted: true,
        updatedAt: '2026-10-01T00:00:00.000Z',
        lines: [{ warehouseId: 'wh-a', itemId: 'item-1', quantity: 2, unitPrice: 10 }],
      },
      {
        id: 'posted-b',
        isPosted: true,
        updatedAt: '2026-10-01T00:00:00.000Z',
        lines: [{ warehouseId: 'wh-b', itemId: 'item-1', quantity: 4, unitPrice: 3 }],
      },
    ]);

    const lines = kept.flatMap((doc) => doc.lines.map((line) => [doc.id, line.warehouseId, line.quantity]));
    expect(lines).toEqual([
      ['posted-a', 'wh-a', 2],
      ['posted-b', 'wh-b', 4],
    ]);
  });

  it('lets an older document keep the warehouses the newer one does not use', () => {
    const kept = openingLinesWithoutWarehouseOverlap([
      {
        id: 'older',
        isPosted: true,
        updatedAt: '2026-09-01T00:00:00.000Z',
        lines: [
          { warehouseId: 'wh-a', itemId: 'item-1', quantity: 1, unitPrice: 1 },
          { warehouseId: 'wh-b', itemId: 'item-2', quantity: 8, unitPrice: 1 },
        ],
      },
      {
        id: 'newer',
        isPosted: true,
        updatedAt: '2026-10-01T00:00:00.000Z',
        lines: [{ warehouseId: 'wh-a', itemId: 'item-1', quantity: 3, unitPrice: 1 }],
      },
    ]);

    expect(kept.find((doc) => doc.id === 'newer')?.lines.map((line) => line.warehouseId)).toEqual(['wh-a']);
    expect(kept.find((doc) => doc.id === 'older')?.lines.map((line) => line.warehouseId)).toEqual(['wh-b']);
  });

  it('rejects the same item twice in one warehouse', () => {
    expect(
      duplicateOpeningStockLine([
        { warehouseId: 'wh-a', itemId: 'item-1', quantity: 1, unitPrice: 1 },
        { warehouseId: 'wh-a', itemId: 'item-1', quantity: 2, unitPrice: 1 },
      ])
    ).toBe(true);
    expect(
      duplicateOpeningStockLine([
        { warehouseId: 'wh-a', itemId: 'item-1', quantity: 1, unitPrice: 1 },
        { warehouseId: 'wh-b', itemId: 'item-1', quantity: 2, unitPrice: 1 },
      ])
    ).toBe(false);
    expect(
      duplicateOpeningStockLine([
        { warehouseId: 'wh-a', itemId: 'item-1', quantity: 1, unitPrice: 1, batchNumber: 'A' },
        { warehouseId: 'wh-a', itemId: 'item-1', quantity: 2, unitPrice: 1, batchNumber: 'B' },
      ])
    ).toBe(false);
  });
});
