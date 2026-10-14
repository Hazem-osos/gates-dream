import { contractingPostingService } from '../../modules/contracting/services/contracting-posting.service';
import prisma from '../../shared/database/prisma';
import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';
import { contractingAccountResolverService } from '../../modules/contracting/services/contracting-account-resolver.service';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    contractExtract: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../modules/accounting/services/journal-posting.service', () => ({
  journalPostingService: {
    createAndPostInTx: jest.fn(),
    reverseJournalEntryInTx: jest.fn(),
  },
}));

jest.mock('../../modules/contracting/services/contracting-account-resolver.service', () => ({
  contractingAccountResolverService: {
    resolveAccounts: jest.fn(),
  },
}));

jest.mock('../../modules/platform/services/document-sequence.service', () => ({
  documentSequenceService: { nextGlNumber: jest.fn().mockResolvedValue('GL-1') },
}));

const mockedPrisma = prisma as unknown as {
  contractExtract: {
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('contract extract post idempotency', () => {
  const ctx = {
    companyId: 'co-1',
    branchId: 'br-1',
    userId: 'u-1',
    fiscalYearId: 'fy-1',
    isAdmin: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the existing posted extract instead of creating a second journal', async () => {
    const posted = {
      id: 'ex-1',
      status: 'POSTED',
      journalEntryId: 'je-1',
      extractType: 'CLIENT',
      extractNumber: 'CE-1',
      extractDate: new Date('2026-01-15'),
      periodEnd: null,
      currentExecutedAmount: '100',
      advancePaymentDeduction: '0',
      retentionDeduction: '0',
      whtDeduction: '0',
      penalties: '0',
      vatAmount: '0',
      netPayableAmount: '100',
      project: { costCenterId: null, id: 'p1', advancePaymentBalance: '0' },
      projectSubcontractId: null,
    };
    mockedPrisma.contractExtract.findFirst.mockResolvedValue(posted);
    mockedPrisma.contractExtract.findFirstOrThrow.mockResolvedValue({
      ...posted,
      lines: [],
      project: posted.project,
    });

    const result = await contractingPostingService.postContractExtract(ctx as never, 'ex-1');
    expect(result.journalEntryId).toBe('je-1');
    expect(journalPostingService.createAndPostInTx).not.toHaveBeenCalled();
    expect(contractingAccountResolverService.resolveAccounts).not.toHaveBeenCalled();
  });

  it('does not reverse a journal that is not this extract\'s entry', async () => {
    const posted = {
      id: 'ex-1',
      companyId: 'co-1',
      status: 'POSTED',
      journalEntryId: 'je-extract-only',
      extractType: 'CLIENT',
      extractNumber: 'CE-1',
      advancePaymentDeduction: '0',
      project: { id: 'p1', advancePaymentBalance: '0' },
      projectSubcontractId: null,
      projectSubcontract: null,
    };
    mockedPrisma.contractExtract.findFirst.mockResolvedValue(posted);
    const tx = {
      contractExtract: { update: jest.fn().mockResolvedValue({ ...posted, status: 'APPROVED', journalEntryId: null }) },
      contractingProject: { update: jest.fn() },
    };
    mockedPrisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await contractingPostingService.unpostContractExtract(ctx as never, 'ex-1');

    expect(journalPostingService.reverseJournalEntryInTx).toHaveBeenCalledWith(
      tx,
      ctx,
      'je-extract-only',
      expect.objectContaining({ reason: 'Contract extract unposted' })
    );
    expect(mockedPrisma.contractExtract.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ex-1', companyId: 'co-1' } })
    );
  });

  it('returns 409 when a concurrent post already claimed the extract', async () => {
    const draft = {
      id: 'ex-1',
      companyId: 'co-1',
      status: 'DRAFT',
      journalEntryId: null,
      extractType: 'CLIENT',
      extractNumber: 'CE-1',
      extractDate: new Date('2026-01-15'),
      periodEnd: null,
      currentExecutedAmount: '100',
      advancePaymentDeduction: '0',
      retentionDeduction: '0',
      whtDeduction: '0',
      penalties: '0',
      vatAmount: '0',
      netPayableAmount: '100',
      project: { costCenterId: null, id: 'p1', advancePaymentBalance: '0' },
      projectSubcontractId: null,
    };
    mockedPrisma.contractExtract.findFirst.mockResolvedValue(draft);
    (contractingAccountResolverService.resolveAccounts as jest.Mock).mockResolvedValue({
      clientReceivableAccountId: 'ar',
      revenueAccountId: 'rev',
      vatOutputAccountId: 'vat',
      retentionReceivableAccountId: 'ret',
      advanceFromClientAccountId: 'adv',
      whtReceivableAccountId: 'wht',
    });
    const tx = {
      contractExtract: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ ...draft, status: 'DRAFT', journalEntryId: null }),
      },
    };
    mockedPrisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await expect(contractingPostingService.postContractExtract(ctx as never, 'ex-1')).rejects.toThrow(
      /already being posted/
    );
    expect(journalPostingService.createAndPostInTx).not.toHaveBeenCalled();
  });
});
