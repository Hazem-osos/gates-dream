import {
  invoiceDiffersFromSubmittedPayload,
  resolveEtaAmendmentMethod,
} from '../../modules/electronic-invoices/utils/eta-amendment';

const originalPayload = {
  netAmount: 1500,
  totalAmount: 1710,
  taxTotals: [{ amount: 210 }],
  dateTimeIssued: '2026-09-28T10:16:19.000Z',
  invoiceLines: [{ quantity: 1, itemCode: 'EG-262290472-102020', total: 1710, netTotal: 1500 }],
};

describe('ETA amendment after submit', () => {
  it('detects a later amount or line change', () => {
    expect(
      invoiceDiffersFromSubmittedPayload({
        netAmount: 1710,
        taxAmount: 210,
        date: new Date('2026-09-28'),
        lines: [{ quantity: 1, price: 1500 }],
        payload: originalPayload,
      })
    ).toBe(false);

    expect(
      invoiceDiffersFromSubmittedPayload({
        netAmount: 2000,
        taxAmount: 210,
        date: new Date('2026-09-28'),
        lines: [{ quantity: 1, price: 1500 }],
        payload: originalPayload,
      })
    ).toBe(true);
  });

  it('uses cancel-and-resubmit inside 72 hours and C/D notes after', () => {
    const recent = new Date(Date.now() - 2 * 3_600_000);
    expect(
      resolveEtaAmendmentMethod({
        issuedAt: recent,
        submittedNet: 1710,
        currentNet: 1500,
        structuralChange: false,
      }).method
    ).toBe('cancel-resubmit');

    const old = new Date(Date.now() - 80 * 3_600_000);
    expect(
      resolveEtaAmendmentMethod({
        issuedAt: old,
        submittedNet: 1710,
        currentNet: 1500,
        structuralChange: false,
      }).method
    ).toBe('credit');
    expect(
      resolveEtaAmendmentMethod({
        issuedAt: old,
        submittedNet: 1500,
        currentNet: 1710,
        structuralChange: false,
      }).method
    ).toBe('debit');
  });
});
