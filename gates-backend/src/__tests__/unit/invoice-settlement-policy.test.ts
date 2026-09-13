import {
  INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE,
  INVOICE_UNPOST_BLOCKED_CHEQUE_MESSAGE,
  invoiceHasLinkedSettlementRecords,
  invoiceHasUnclearedSettlementHistory,
  isChequeStatusBlockingInvoiceUnpost,
  shouldSkipInvoiceAutoSettle,
} from '../../modules/invoices/services/invoice-settlement-policy';

describe('invoice settlement policy', () => {
  it('blocks unpost when a cheque has left the portfolio', () => {
    expect(isChequeStatusBlockingInvoiceUnpost('SENT_TO_BANK')).toBe(true);
    expect(isChequeStatusBlockingInvoiceUnpost('COLLECTED')).toBe(true);
    expect(isChequeStatusBlockingInvoiceUnpost('CLEARED')).toBe(true);
    expect(isChequeStatusBlockingInvoiceUnpost('cleared')).toBe(true);
    expect(isChequeStatusBlockingInvoiceUnpost('ENDORSED')).toBe(true);
    expect(isChequeStatusBlockingInvoiceUnpost('UNDER_HAND')).toBe(false);
    expect(isChequeStatusBlockingInvoiceUnpost('IN_PORTFOLIO')).toBe(false);
    expect(isChequeStatusBlockingInvoiceUnpost('ISSUED')).toBe(false);
    expect(INVOICE_UNPOST_BLOCKED_CHEQUE_MESSAGE).toMatch(/بالبنك/);
  });

  it('skips auto-settle when active allocations or cheques already exist', () => {
    expect(shouldSkipInvoiceAutoSettle(1, 0)).toBe(true);
    expect(shouldSkipInvoiceAutoSettle(0, 1)).toBe(true);
    expect(shouldSkipInvoiceAutoSettle(0, 0)).toBe(false);
  });

  it('treats remainingAmount !== net or live allocations as uncleared history', () => {
    expect(
      invoiceHasUnclearedSettlementHistory({
        remainingAmount: 3000,
        netAmount: 3000,
        activeAllocationCount: 0,
        activeChequeCount: 0,
      })
    ).toBe(false);

    expect(
      invoiceHasUnclearedSettlementHistory({
        remainingAmount: 1000,
        netAmount: 3000,
        activeAllocationCount: 0,
        activeChequeCount: 0,
      })
    ).toBe(true);

    expect(
      invoiceHasUnclearedSettlementHistory({
        remainingAmount: 3000,
        netAmount: 3000,
        activeAllocationCount: 1,
        activeChequeCount: 0,
      })
    ).toBe(true);
  });

  it('blocks hard delete when any settlement row is still linked', () => {
    expect(
      invoiceHasLinkedSettlementRecords({
        paymentAllocations: 0,
        cashTransactions: 0,
        cheques: 0,
      })
    ).toBe(false);
    expect(
      invoiceHasLinkedSettlementRecords({
        paymentAllocations: 1,
        cashTransactions: 0,
        cheques: 0,
      })
    ).toBe(true);
    expect(
      invoiceHasLinkedSettlementRecords({
        paymentAllocations: 0,
        cashTransactions: 1,
        cheques: 0,
      })
    ).toBe(true);
    expect(
      invoiceHasLinkedSettlementRecords({
        paymentAllocations: 0,
        cashTransactions: 0,
        cheques: 1,
      })
    ).toBe(true);
    expect(INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE).toMatch(/settlements/);
  });
});
