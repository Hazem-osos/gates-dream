import {
  primaryFinishedOutputQuantity,
  finishedReceiptAtIssueFromMetadata,
} from './production-order-finished-output';

describe('primaryFinishedOutputQuantity', () => {
  it('uses primary output line for finished item', () => {
    const qty = primaryFinishedOutputQuantity({
      finishedItemId: 'fg-1',
      plannedQuantity: 2,
      processMetadata: {
        outputLinesSnapshot: [
          { itemId: 'fg-1', quantity: 12 },
          { itemId: 'other', quantity: 1 },
        ],
      },
    });
    expect(qty).toBe(12);
  });

  it('falls back to planned quantity', () => {
    expect(
      primaryFinishedOutputQuantity({
        finishedItemId: 'fg-1',
        plannedQuantity: 5,
        processMetadata: {},
      })
    ).toBe(5);
  });
});

describe('finishedReceiptAtIssueFromMetadata', () => {
  it('reads receipt marker', () => {
    const row = finishedReceiptAtIssueFromMetadata({
      finishedReceiptAtIssue: { quantity: 3, unitCost: 10, receivedAt: 'x' },
    });
    expect(row?.quantity).toBe(3);
    expect(row?.unitCost).toBe(10);
  });
});
