import {
  primaryFinishedOutputQuantity,
  finishedReceiptAtIssueFromMetadata,
  finishedOutputBaselineAfterIssue,
  mergeProcessMetadataPreservingIssueReceipt,
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

describe('finishedOutputBaselineAfterIssue', () => {
  it('uses metadata receipt first', () => {
    expect(
      finishedOutputBaselineAfterIssue({
        processMetadata: { finishedReceiptAtIssue: { quantity: 4, unitCost: 1, receivedAt: 'x' } },
        materialsIssueJournalEntryId: 'je-1',
        actualQuantity: 99,
      })
    ).toBe(4);
  });

  it('falls back to actual quantity when metadata was wiped', () => {
    expect(
      finishedOutputBaselineAfterIssue({
        processMetadata: { description: 'x' },
        materialsIssueJournalEntryId: 'je-1',
        actualQuantity: 7,
      })
    ).toBe(7);
  });
});

describe('mergeProcessMetadataPreservingIssueReceipt', () => {
  it('re-attaches finishedReceiptAtIssue when client omits it', () => {
    const merged = mergeProcessMetadataPreservingIssueReceipt(
      { finishedReceiptAtIssue: { quantity: 2, unitCost: 5, receivedAt: 't' } },
      { description: 'updated' }
    );
    expect(merged?.description).toBe('updated');
    expect(finishedReceiptAtIssueFromMetadata(merged)?.quantity).toBe(2);
  });
});
