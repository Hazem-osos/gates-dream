const replace = jest.fn().mockResolvedValue({ id: 'je-old' });
const reuse = jest.fn().mockResolvedValue({ id: 'je-old' });
const cashUpdate = jest.fn().mockResolvedValue({ id: 'cash-1' });

const cash = {
  id: 'cash-1',
  companyId: 'co-1',
  journalEntryId: 'je-old',
  isCancelled: false,
  transactionKind: 'RECEIPT',
  amount: 100,
  safeId: 'safe-1',
  bankAccountId: null,
  customerId: 'cust-1',
  supplierId: null,
  offsetAccountId: null,
  invoiceId: null,
  exchangeRate: 1,
  currencyCode: 'EGP',
  voucherNumber: '15',
  date: new Date('2026-09-01T00:00:00.000Z'),
  hijriDate: null,
  description: 'سند قبض',
  lines: [],
  treasuryReceipt: null,
  treasuryPayment: null,
};

const tx = {
  safe: { update: jest.fn().mockResolvedValue({}) },
  customer: { update: jest.fn().mockResolvedValue({}) },
  supplier: { update: jest.fn().mockResolvedValue({}) },
  bankAccount: { update: jest.fn().mockResolvedValue({}) },
  cashTransaction: {
    findFirst: jest.fn().mockResolvedValue(cash),
    update: cashUpdate,
    findFirstOrThrow: jest.fn().mockResolvedValue({ ...cash, journalEntryId: 'je-old' }),
  },
};

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    cashTransaction: {
      findFirst: jest.fn().mockResolvedValue(cash),
    },
  },
}));

jest.mock('../../modules/accounting/services/journal-posting.service', () => ({
  journalPostingService: { replacePostedJournalInTx: replace, reuseSourceJournalInTx: reuse },
}));

jest.mock('../../modules/accounting/services/auto-gl-posting.service', () => ({
  autoGlPostingService: { commitInTx: jest.fn() },
}));

jest.mock('../../modules/treasury/services/treasury-account-resolver.service', () => ({
  treasuryAccountResolverService: {
    resolveSafeGlAccountId: jest.fn().mockResolvedValue('safe-gl'),
    resolvePartyAccountId: jest.fn().mockResolvedValue('party-gl'),
  },
}));

jest.mock('../../modules/treasury/services/treasury-overdraft', () => ({
  assertCashOverdraftAllowed: jest.fn(),
}));

jest.mock('../../modules/platform/services/document-sequence.service', () => ({
  documentSequenceService: {},
}));

jest.mock('../../modules/platform/services/advanced-rights.service', () => ({
  advancedRightsService: {},
}));

jest.mock('../../modules/treasury/services/bank-box-rights.service', () => ({
  bankBoxRightsService: {},
}));

jest.mock('../../modules/treasury/services/cash-transaction.service', () => ({
  ensureCashTransactionFromPayment: jest.fn(),
  ensureCashTransactionFromReceipt: jest.fn(),
}));

jest.mock('../../modules/treasury/services/cash-disbursement-workflow.service', () => ({
  cashDisbursementWorkflowService: {},
}));

import { treasuryPostingService } from '../../modules/treasury/services/treasury-posting.service';

describe('posted cash voucher edit', () => {
  it('rewrites the same posted journal in place', async () => {
    await treasuryPostingService.rewritePostedCashJournalInTx(
      tx as never,
      { companyId: 'co-1', userId: 'user-1', fiscalYearId: 'fy-1' },
      'cash-1',
      cash as never
    );

    expect(reuse).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ companyId: 'co-1' }),
      'je-old',
      expect.objectContaining({
        currencyCode: 'EGP',
        sourceNumber: '15',
      })
    );
    expect(replace).not.toHaveBeenCalled();
    expect(cashUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: { increment: 1 } }),
      })
    );
    expect(cashUpdate.mock.calls[0][0].data.journalEntryId).toBeUndefined();
  });
});
