import { describe, expect, it } from 'vitest';
import {
  invoiceNetBelowPaymentConfirmMessage,
  invoiceNetCoversCollections,
  linkedInvoicePaidAmount,
  postedSettlementPaidTotal,
} from './invoice-collected-guard';

describe('invoice collected guard', () => {
  it('detects invoice net below the linked payment', () => {
    expect(invoiceNetCoversCollections(800, 1000)).toBe(false);
    expect(invoiceNetCoversCollections(1000, 800)).toBe(true);
  });

  it('uses posted settlements when invoice paidAmount is stale', () => {
    expect(postedSettlementPaidTotal([{ amount: 400, isPosted: true, isCancelled: false }])).toBe(400);
    expect(postedSettlementPaidTotal([{ amount: 400, isPosted: false, isCancelled: false }])).toBe(0);
    expect(linkedInvoicePaidAmount(0, 400)).toBe(400);
    expect(linkedInvoicePaidAmount(500, 400)).toBe(500);
  });

  it('asks the user to confirm save when net is below سند الصرف', () => {
    const message = invoiceNetBelowPaymentConfirmMessage(800, 1000);
    expect(message).toMatch(/أقل من سند الصرف/);
    expect(message).toMatch(/تأكيد الحفظ/);
  });
});
