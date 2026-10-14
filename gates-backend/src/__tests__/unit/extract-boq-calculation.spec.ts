import {
  applyServerPreviousQuantities,
  computeBoqLines,
  computeExtractFinancials,
  quantityTimesPrice,
} from '../../modules/contracting/services/extract-boq-calculation.util';
import { AppError } from '../../shared/middleware/error-handler';

describe('quantity × unit price (statement / BOQ leaf)', () => {
  it('preserves handwritten 0.15 × 13,500 = 2,025', () => {
    expect(quantityTimesPrice(0.15, 13_500)).toBe(2_025);
  });

  it('preserves handwritten 22.5 × 13,500 = 303,750', () => {
    expect(quantityTimesPrice(22.5, 13_500)).toBe(303_750);
  });

  it('rounds to 4 decimal places (Gates convention)', () => {
    expect(quantityTimesPrice(0.3333, 3)).toBe(0.9999);
  });
});

describe('computeBoqLines', () => {
  it('computes current vs cumulative from previous + current', () => {
    const { lines, currentExecutedAmount } = computeBoqLines([
      {
        boqItemId: 'leaf-1',
        previousQuantity: 10,
        currentQuantity: 22.5,
        unitPrice: 13_500,
        contractQuantity: 40,
      },
    ]);
    expect(lines[0].cumulativeQuantity).toBe(32.5);
    expect(lines[0].lineTotal).toBe(303_750);
    expect(currentExecutedAmount).toBe(303_750);
  });

  it('rejects non-finite quantities and unit prices', () => {
    expect(() =>
      computeBoqLines([
        { boqItemId: 'a', previousQuantity: 0, currentQuantity: Number.NaN, unitPrice: 1 },
      ])
    ).toThrow(/finite numbers/);
    expect(() =>
      computeBoqLines([
        { boqItemId: 'a', previousQuantity: 0, currentQuantity: Number.POSITIVE_INFINITY, unitPrice: 1 },
      ])
    ).toThrow(/finite numbers/);
  });

  it('rejects negative quantities and duplicate BOQ lines', () => {
    expect(() =>
      computeBoqLines([
        { boqItemId: 'a', previousQuantity: 0, currentQuantity: -1, unitPrice: 1 },
      ])
    ).toThrow(AppError);
    expect(() =>
      computeBoqLines([
        { boqItemId: 'a', previousQuantity: 0, currentQuantity: 1, unitPrice: 1 },
        { boqItemId: 'a', previousQuantity: 0, currentQuantity: 1, unitPrice: 1 },
      ])
    ).toThrow(/Duplicate BOQ item/);
  });

  it('overwrites client previous quantity with posted certified qty', () => {
    const applied = applyServerPreviousQuantities(
      [{ boqItemId: 'a', previousQuantity: 99, currentQuantity: 1, unitPrice: 10 }],
      { a: 4 }
    );
    expect(applied[0].previousQuantity).toBe(4);
    expect(computeBoqLines(applied).lines[0].cumulativeQuantity).toBe(5);
  });
});

describe('computeExtractFinancials', () => {
  it('uses current executed amount as the deduction base, not client-supplied net', () => {
    const result = computeExtractFinancials({
      currentExecutedAmount: 1000,
      previousExecutedAmount: 2000,
      advanceDeductionPercent: 10,
      retentionPercent: 5,
      vatRate: 0.14,
      whtRate: 0.01,
      extractType: 'CLIENT',
    });
    expect(result.totalExecutedAmount).toBe(3000);
    expect(result.advancePaymentDeduction).toBe(100);
    expect(result.retentionDeduction).toBe(50);
    expect(result.whtDeduction).toBe(10);
    expect(result.vatAmount).toBe(119);
    expect(result.netPayableAmount).toBe(959);
  });
});
