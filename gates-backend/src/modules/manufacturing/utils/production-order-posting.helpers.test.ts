import {
  additionalCostsTotalFromMetadata,
  productionMaterialPostingChanged,
  productionOrderUsesUnifiedIssue,
} from './production-order-posting.helpers';

describe('production-order-posting helpers', () => {
  it('sums additional costs from metadata', () => {
    expect(
      additionalCostsTotalFromMetadata({
        additionalCosts: [{ value: 10 }, { value: '5.5' }, { value: 0 }],
      })
    ).toBe(15.5);
  });

  it('detects material fingerprint change', () => {
    const base = {
      bomId: 'b1',
      plannedQuantity: 2,
      warehouseIdRaw: 'w1',
      warehouseIdFinished: 'w2',
      processMetadata: { rawLinesSnapshot: [{ rawItemId: 'r1', quantity: 3 }] },
    };
    expect(productionMaterialPostingChanged(base, base)).toBe(false);
    expect(
      productionMaterialPostingChanged(base, {
        ...base,
        processMetadata: { rawLinesSnapshot: [{ rawItemId: 'r1', quantity: 4 }] },
      })
    ).toBe(true);
  });

  it('flags unified issue orders', () => {
    expect(productionOrderUsesUnifiedIssue({ additionalCostsJournalEntryId: 'je-1' })).toBe(true);
    expect(productionOrderUsesUnifiedIssue({ additionalCostsJournalEntryId: null })).toBe(false);
  });
});
