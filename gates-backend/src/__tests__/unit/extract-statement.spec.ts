import {
  aggregatePreviousWorkItemQuantities,
  computeExtractLines,
  remainingFromContract,
} from '../../modules/extracts/utils/extract-statement.util';

const parent = {
  id: 'p',
  parentId: null,
  isExecutable: false,
  itemNumber: '1',
  arabicName: 'أعمال خرسانية',
  quantity: 1,
  unit: 'بند',
  unitPrice: 303_750,
};

const child = {
  id: 'c',
  parentId: 'p',
  isExecutable: true,
  itemNumber: '1.1',
  arabicName: 'خرسانة',
  quantity: 22.5,
  unit: 'م3',
  unitPrice: 13_500,
};

describe('legacy extract statement lines', () => {
  it('computes current 22.5 × 13,500 = 303,750 and ignores client totalPrice', () => {
    const { lines, totalValue } = computeExtractLines({
      workItems: [parent, child],
      previousQuantityByWorkItemId: {},
      lines: [
        {
          workItemId: 'c',
          itemName: 'خرسانة',
          quantity: 22.5,
          unitPrice: 13_500,
          totalPrice: 1,
        },
      ],
    });
    expect(lines[0].currentQuantity).toBe(22.5);
    expect(lines[0].cumulativeQuantity).toBe(22.5);
    expect(lines[0].remainingQuantity).toBe(0);
    expect(lines[0].totalPrice).toBe(303_750);
    expect(lines[0].currentAmount).toBe(303_750);
    expect(lines[0].cumulativeAmount).toBe(303_750);
    expect(totalValue).toBe(303_750);
  });

  it('adds previous certified quantity into cumulative', () => {
    const { lines } = computeExtractLines({
      workItems: [child],
      previousQuantityByWorkItemId: { c: 10 },
      lines: [{ workItemId: 'c', itemName: 'خرسانة', quantity: 5, unitPrice: 13_500 }],
    });
    expect(lines[0].previousQuantity).toBe(10);
    expect(lines[0].cumulativeQuantity).toBe(15);
    expect(lines[0].remainingQuantity).toBe(7.5);
    expect(lines[0].previousAmount).toBe(135_000);
    expect(lines[0].currentAmount).toBe(67_500);
  });

  it('rejects certifying a header parent when children exist', () => {
    expect(() =>
      computeExtractLines({
        workItems: [parent, child],
        previousQuantityByWorkItemId: {},
        lines: [{ workItemId: 'p', itemName: 'أعمال', quantity: 1, unitPrice: 303_750 }],
      })
    ).toThrow(/EXTRACT_HEADER_NOT_CERTIFIABLE/);
  });

  it('rejects duplicate work items and quantities over BOQ', () => {
    expect(() =>
      computeExtractLines({
        workItems: [child],
        previousQuantityByWorkItemId: {},
        lines: [
          { workItemId: 'c', itemName: 'a', quantity: 1, unitPrice: 1 },
          { workItemId: 'c', itemName: 'b', quantity: 1, unitPrice: 1 },
        ],
      })
    ).toThrow(/EXTRACT_DUPLICATE_WORK_ITEM/);

    expect(() =>
      computeExtractLines({
        workItems: [child],
        previousQuantityByWorkItemId: { c: 20 },
        lines: [{ workItemId: 'c', itemName: 'خرسانة', quantity: 3, unitPrice: 13_500 }],
      })
    ).toThrow(/EXTRACT_QTY_EXCEEDS_BOQ/);
  });

  it('computes remaining after current 0.15 on previous 22.35 against 22.5', () => {
    const { lines } = computeExtractLines({
      workItems: [child],
      previousQuantityByWorkItemId: { c: 22.35 },
      lines: [{ workItemId: 'c', itemName: 'خرسانة', quantity: 0.15, unitPrice: 13_500 }],
    });
    expect(lines[0].currentAmount).toBe(2_025);
    expect(lines[0].cumulativeQuantity).toBe(22.5);
    expect(lines[0].cumulativeAmount).toBe(303_750);
    expect(lines[0].remainingQuantity).toBe(0);
  });

  it('accepts an executable leaf and rejects a header even when isExecutable is stale true', () => {
    const staleParent = { ...parent, isExecutable: true };
    const { totalValue } = computeExtractLines({
      workItems: [staleParent, child],
      previousQuantityByWorkItemId: {},
      lines: [{ workItemId: 'c', itemName: 'خرسانة', quantity: 22.5, unitPrice: 13_500 }],
    });
    expect(totalValue).toBe(303_750);
    expect(() =>
      computeExtractLines({
        workItems: [staleParent, child],
        previousQuantityByWorkItemId: {},
        lines: [{ workItemId: 'p', itemName: 'أعمال', quantity: 1, unitPrice: 1 }],
      })
    ).toThrow(/EXTRACT_HEADER_NOT_CERTIFIABLE/);
  });

  it('certifies dashed lump-sum siblings independently', () => {
    const ls1 = {
      id: 'ls1',
      parentId: null,
      isExecutable: true,
      itemNumber: 'P4-LS',
      arabicName: 'P4 Works',
      quantity: 1,
      unit: 'LS',
      unitPrice: 100_000,
    };
    const ls2 = { ...ls1, id: 'ls2', itemNumber: 'P4-LS-2', arabicName: 'P4 Works period 2' };
    const { totalValue } = computeExtractLines({
      workItems: [ls1, ls2],
      previousQuantityByWorkItemId: {},
      lines: [
        { workItemId: 'ls1', itemName: 'P4 Works', quantity: 1, unitPrice: 100_000 },
        { workItemId: 'ls2', itemName: 'P4 Works period 2', quantity: 1, unitPrice: 100_000 },
      ],
    });
    expect(totalValue).toBe(200_000);
  });

  it('rejects NaN and infinite quantities', () => {
    expect(() =>
      computeExtractLines({
        workItems: [child],
        previousQuantityByWorkItemId: {},
        lines: [{ workItemId: 'c', itemName: 'خرسانة', quantity: Number.NaN, unitPrice: 13_500 }],
      })
    ).toThrow(/EXTRACT_NON_FINITE_AMOUNT/);
    expect(() =>
      computeExtractLines({
        workItems: [child],
        previousQuantityByWorkItemId: {},
        lines: [{ workItemId: 'c', itemName: 'خرسانة', quantity: 1, unitPrice: Number.POSITIVE_INFINITY }],
      })
    ).toThrow(/EXTRACT_NON_FINITE_AMOUNT/);
  });

  it('rejects negative current quantity', () => {
    expect(() =>
      computeExtractLines({
        workItems: [child],
        previousQuantityByWorkItemId: {},
        lines: [{ workItemId: 'c', itemName: 'خرسانة', quantity: -0.15, unitPrice: 13_500 }],
      })
    ).toThrow(/EXTRACT_NEGATIVE_QUANTITY/);
  });

  it('counts draft extracts toward remaining occupancy and ignores cancelled extracts', () => {
    const previous = aggregatePreviousWorkItemQuantities([
      { isCancelled: false, items: [{ workItemId: 'c', quantity: 10 }] },
      { isCancelled: true, items: [{ workItemId: 'c', quantity: 5 }] },
    ]);
    expect(previous.c).toBe(10);
    expect(remainingFromContract(22.5, 10)).toBe(12.5);
  });
});
