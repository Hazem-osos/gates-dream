import {
  UnbalancedJournalEntryException,
} from '../../shared/errors/unbalanced-journal-entry.error';
import {
  assertJournalBalanced,
  normalizeAutoGlSourceType,
} from '../../modules/accounting/services/auto-gl-balance';
import {
  buildContractorExtractPaymentLines,
  buildPurchaseInvoiceLines,
  buildSalesInvoiceLines,
  buildTreasuryPaymentLines,
  buildTreasuryReceiptLines,
} from '../../modules/accounting/services/auto-gl-line-builders';
import { AUTO_GL_SOURCE } from '../../modules/accounting/types/auto-gl-posting.types';

const accounts = {
  arAccountId: 'ar-1',
  apAccountId: 'ap-1',
  cashAccountId: 'cash-1',
  inventoryAccountId: 'inv-1',
  salesAccountId: 'rev-1',
  cogsAccountId: 'cogs-1',
  vatOutputAccountId: 'vat-out',
  vatInputAccountId: 'vat-in',
  withholdingAccountId: 'wht-1',
  contractorAccountId: 'contractor-1',
  retentionAccountId: 'ret-1',
  advanceAccountId: 'adv-1',
};

describe('AutoGlPostingService guards', () => {
  it('maps long source names to short journal sourceType', () => {
    expect(normalizeAutoGlSourceType('SALES_INVOICE')).toBe(AUTO_GL_SOURCE.SALES_INVOICE);
    expect(normalizeAutoGlSourceType('TREASURY_RECEIPT')).toBe('CR');
    expect(normalizeAutoGlSourceType('CHECK_BOUNCE')).toBe('CKB');
    expect(normalizeAutoGlSourceType('SI')).toBe('SI');
  });

  it('accepts a balanced invoice draft (debit = credit)', () => {
    const lines = buildSalesInvoiceLines(accounts, {
      net: 115,
      merchandise: 100,
      tax: 15,
      cogs: 40,
      isCash: false,
      customerId: 'cust-1',
    });
    const { totalDebit, totalCredit } = assertJournalBalanced(lines);
    expect(totalDebit).toBe(155);
    expect(totalCredit).toBe(155);
    expect(lines.some((l) => l.accountId === 'ar-1' && l.debit === 115)).toBe(true);
    expect(lines.some((l) => l.accountId === 'rev-1' && l.credit === 100)).toBe(true);
    expect(lines.some((l) => l.accountId === 'vat-out' && l.credit === 15)).toBe(true);
    expect(lines.some((l) => l.accountId === 'cogs-1' && l.debit === 40)).toBe(true);
    expect(lines.some((l) => l.accountId === 'inv-1' && l.credit === 40)).toBe(true);
  });

  it('throws UnbalancedJournalEntryException when |debit-credit| >= 0.001', () => {
    expect(() =>
      assertJournalBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 99.998 },
      ])
    ).toThrow(UnbalancedJournalEntryException);
  });

  it('allows a sub-cent residual under the 0.001 epsilon', () => {
    expect(() =>
      assertJournalBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 99.9995 },
      ])
    ).not.toThrow();
  });

  it('builds a balanced purchase invoice with input VAT and WHT', () => {
    const lines = buildPurchaseInvoiceLines(accounts, {
      net: 110,
      merchandise: 100,
      tax: 14,
      wht: 4,
      isCash: false,
      supplierId: 'sup-1',
    });
    assertJournalBalanced(lines);
    expect(lines.find((l) => l.accountId === 'ap-1')?.credit).toBe(110);
    expect(lines.find((l) => l.accountId === 'wht-1')?.credit).toBe(4);
  });

  it('builds treasury receipt / payment as two-sided entries', () => {
    const receipt = buildTreasuryReceiptLines({
      treasuryAccountId: 'cash-1',
      counterpartAccountId: 'ar-1',
      amount: 250,
    });
    const payment = buildTreasuryPaymentLines({
      treasuryAccountId: 'cash-1',
      counterpartAccountId: 'ap-1',
      amount: 250,
    });
    assertJournalBalanced(receipt);
    assertJournalBalanced(payment);
    expect(receipt[0].debit).toBe(250);
    expect(payment[1].credit).toBe(250);
  });

  it('builds a contractor extract payment with retention and advance recovery', () => {
    const lines = buildContractorExtractPaymentLines({
      contractorAccountId: 'contractor-1',
      treasuryAccountId: 'cash-1',
      retentionAccountId: 'ret-1',
      advanceAccountId: 'adv-1',
      netPaid: 80,
      retention: 15,
      advance: 5,
    });
    const { totalDebit, totalCredit } = assertJournalBalanced(lines);
    expect(totalDebit).toBe(100);
    expect(totalCredit).toBe(100);
    expect(lines.find((l) => l.accountId === 'contractor-1')?.debit).toBe(100);
  });
});
