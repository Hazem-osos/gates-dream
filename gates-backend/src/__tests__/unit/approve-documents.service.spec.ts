const journalEntryUpdateMany = jest.fn();
const invoiceUpdateMany = jest.fn();

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    journalEntry: { updateMany: journalEntryUpdateMany, findMany: jest.fn() },
    invoice: { updateMany: invoiceUpdateMany, findMany: jest.fn() },
  },
}));

import { approveDocumentsSchema } from '../../modules/database-tools/schemas/database-backup.schema';
import { approveDocumentsService } from '../../modules/database-tools/services/approve-documents.service';

const CO_A = '11111111-1111-4111-8111-111111111111';
const CO_B = '22222222-2222-4222-8222-222222222222';
const JE_1 = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('approveDocumentsSchema', () => {
  it('allows approveAll without documentIds when documentType is set', () => {
    const parsed = approveDocumentsSchema.parse({
      documentIds: [],
      documentType: 'journal-entry',
      approveAll: true,
    });
    expect(parsed.approveAll).toBe(true);
    expect(parsed.documentIds).toEqual([]);
  });

  it('rejects approveAll when documentType is missing', () => {
    expect(() =>
      approveDocumentsSchema.parse({ documentIds: [], approveAll: true })
    ).toThrow();
  });

  it('requires documentIds when approveAll is false', () => {
    expect(() =>
      approveDocumentsSchema.parse({ documentIds: [], approveAll: false })
    ).toThrow();
  });
});

describe('ApproveDocumentsService.approveDocuments', () => {
  it('approves selected journal entries for the current company only', async () => {
    journalEntryUpdateMany.mockResolvedValue({ count: 1 });

    const result = await approveDocumentsService.approveDocuments({
      companyId: CO_A,
      documentIds: [JE_1],
      documentType: 'journal-entry',
      approveAll: false,
    });

    expect(result).toEqual({ approved: 1, failed: 0 });
    expect(journalEntryUpdateMany).toHaveBeenCalledWith({
      where: {
        id: JE_1,
        companyId: CO_A,
        isApproved: false,
        isCancelled: false,
      },
      data: { isApproved: true },
    });
    expect(Object.keys(journalEntryUpdateMany.mock.calls[0][0].data)).toEqual(['isApproved']);
  });

  it('approve all updates only unapproved non-cancelled rows in the company', async () => {
    journalEntryUpdateMany.mockResolvedValue({ count: 4 });

    const result = await approveDocumentsService.approveDocuments({
      companyId: CO_A,
      documentIds: [],
      documentType: 'journal-entry',
      approveAll: true,
    });

    expect(result).toEqual({ approved: 4, failed: 0 });
    expect(journalEntryUpdateMany).toHaveBeenCalledTimes(1);
    expect(journalEntryUpdateMany).toHaveBeenCalledWith({
      where: {
        companyId: CO_A,
        isApproved: false,
        isCancelled: false,
      },
      data: { isApproved: true },
    });
  });

  it('does not approve when document belongs to another company', async () => {
    journalEntryUpdateMany.mockResolvedValue({ count: 0 });

    const result = await approveDocumentsService.approveDocuments({
      companyId: CO_B,
      documentIds: [JE_1],
      documentType: 'journal-entry',
      approveAll: false,
    });

    expect(result).toEqual({ approved: 0, failed: 1 });
    expect(journalEntryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: CO_B }),
      })
    );
  });

  it('leaves cancelled documents untouched (updateMany matches zero rows)', async () => {
    journalEntryUpdateMany.mockResolvedValue({ count: 0 });

    const result = await approveDocumentsService.approveDocuments({
      companyId: CO_A,
      documentIds: [JE_1],
      documentType: 'journal-entry',
      approveAll: false,
    });

    expect(result).toEqual({ approved: 0, failed: 1 });
    expect(journalEntryUpdateMany.mock.calls[0][0].where.isCancelled).toBe(false);
  });

  it('never sends posting or workflow fields in the update payload', async () => {
    journalEntryUpdateMany.mockResolvedValue({ count: 1 });

    await approveDocumentsService.approveDocuments({
      companyId: CO_A,
      documentIds: [JE_1],
      documentType: 'journal-entry',
      approveAll: false,
    });

    const data = journalEntryUpdateMany.mock.calls[0][0].data;
    expect(data).toEqual({ isApproved: true });
    expect(data).not.toHaveProperty('isPosted');
    expect(data).not.toHaveProperty('postingStatus');
    expect(data).not.toHaveProperty('workflowStatus');
    expect(data).not.toHaveProperty('deletedAt');
    expect(data).not.toHaveProperty('activeSourceKey');
  });
});
