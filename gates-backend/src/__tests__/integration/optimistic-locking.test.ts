/**
 * M14 fix (Item 40): draft-document edits (unposted journal entries,
 * unposted invoices) were last-write-wins — two concurrent editors could
 * silently clobber each other with no error and no trace of the lost
 * write. Verifies the `version` optimistic-locking column added to both
 * models actually rejects a stale write with 409 instead of applying it.
 */
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';
import { invoiceM5Service } from '../../modules/invoices/services/invoice-m5.service';
import { AppError } from '../../shared/middleware/error-handler';

loadEnv({ override: true });

const prisma = new PrismaClient();

describe('Optimistic locking (M14)', () => {
  jest.setTimeout(60_000);

  let companyId: string;
  let accountA: string;
  let accountB: string;
  let warehouseId: string;
  let itemId: string;
  let unitId: string;
  let customerId: string;

  beforeAll(async () => {
    const suffix = String(Date.now());
    const company = await prisma.company.create({
      data: {
        arabicName: `Optimistic Locking ${suffix}`,
        englishName: `Optimistic Locking ${suffix}`,
        isActive: true,
      },
    });
    companyId = company.id;

    await prisma.fiscalYear.create({
      data: {
        companyId,
        legacyYearId: '2026',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
        status: 'Open',
        isActive: true,
      },
    });

    const [accA, accB] = await Promise.all([
      prisma.account.create({
        data: { companyId, code: `A-${suffix}`, arabicName: 'Cash', accountType: 'asset' },
      }),
      prisma.account.create({
        data: { companyId, code: `B-${suffix}`, arabicName: 'Revenue', accountType: 'revenue' },
      }),
    ]);
    accountA = accA.id;
    accountB = accB.id;

    const warehouse = await prisma.warehouse.create({
      data: { companyId, arabicName: `Main WH ${suffix}` },
    });
    warehouseId = warehouse.id;

    const unit = await prisma.unit.create({
      data: { companyId, arabicName: `Unit ${suffix}` },
    });
    unitId = unit.id;

    const item = await prisma.item.create({
      data: { companyId, arabicName: `Item ${suffix}` },
    });
    itemId = item.id;

    const customer = await prisma.customer.create({
      data: { companyId, arabicName: `Customer ${suffix}` },
    });
    customerId = customer.id;

    // Sidesteps the negative-stock guard on invoice edits — this test is
    // about the optimistic-locking guard, not inventory availability.
    await prisma.companySettings.create({
      data: { companyId, allowNegativeBalance: true },
    });
  });

  afterAll(async () => {
    await prisma.journalEntryLine.deleteMany({ where: { journalEntry: { companyId } } });
    await prisma.journalEntry.deleteMany({ where: { companyId } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { companyId } } });
    await prisma.invoice.deleteMany({ where: { companyId } });
    await prisma.activityLog.deleteMany({ where: { tenantId: companyId } });
    await prisma.documentSequence.deleteMany({ where: { companyId } });
    await prisma.companySettings.deleteMany({ where: { companyId } });
    await prisma.customer.deleteMany({ where: { companyId } });
    await prisma.item.deleteMany({ where: { companyId } });
    await prisma.unit.deleteMany({ where: { companyId } });
    await prisma.warehouse.deleteMany({ where: { companyId } });
    await prisma.account.deleteMany({ where: { companyId } });
    await prisma.fiscalYear.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('rejects an updateJournalEntry write when the row was changed after it was read (409)', async () => {
    const ctx = { companyId, branchId: undefined as unknown as string, userId: 'test-user' };
    const created = await journalPostingService.createJournalEntry(ctx as never, {
      date: new Date('2026-03-01T00:00:00.000Z'),
      currencyCode: 'SAR',
      description: 'Original',
      lines: [
        { accountId: accountA, debit: 100, credit: 0, lineOrder: 1 },
        { accountId: accountB, debit: 0, credit: 100, lineOrder: 2 },
      ],
    });
    expect(created?.version).toBe(0);

    // Simulate two editors loading the same entry, then both submitting.
    await journalPostingService.updateJournalEntry(ctx as never, created!.id, {
      description: 'Edited by user A',
    });

    const stale = await prisma.journalEntry.findUnique({ where: { id: created!.id } });
    expect(stale?.version).toBe(1);

    // User B's in-memory copy still thinks the version is 0 (its own read
    // happened before A's write committed) — the transactional guard must
    // catch this even though B never explicitly sent `expectedVersion`.
    await expect(
      journalPostingService.updateJournalEntry(ctx as never, created!.id, {
        description: 'Edited by user B',
        expectedVersion: 0,
      })
    ).rejects.toMatchObject({ statusCode: 409 } satisfies Partial<AppError>);

    const final = await prisma.journalEntry.findUnique({ where: { id: created!.id } });
    expect(final?.description).toBe('Edited by user A');
    expect(final?.version).toBe(1);
  });

  it('rejects an invoiceM5Service.update write when expectedVersion is stale (409)', async () => {
    const invoice = await invoiceM5Service.create(
      companyId,
      undefined,
      undefined,
      {
        invoiceKind: 'SALE',
        customerId,
        warehouseId,
        date: new Date('2026-03-01T00:00:00.000Z'),
        currencyCode: 'SAR',
        exchangeRate: 1,
        withholdingTaxAmount: 0,
        lines: [
          {
            itemId,
            unitId,
            quantity: 1,
            baseQuantity: 1,
            price: 50,
            lineOrder: 1,
          },
        ],
      } as never,
      'test-user'
    );
    const invoiceId = invoice!.id;
    expect((invoice as { version: number }).version).toBe(1);

    await invoiceM5Service.update(companyId, invoiceId, { description: 'Edited by user A' });

    const afterA = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(afterA?.version).toBe(2);

    await expect(
      invoiceM5Service.update(companyId, invoiceId, {
        description: 'Edited by user B',
        expectedVersion: 0,
      })
    ).rejects.toMatchObject({ statusCode: 409 } satisfies Partial<AppError>);

    const final = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(final?.description).toBe('Edited by user A');
    expect(final?.version).toBe(2);
  });

  it('allows an update when expectedVersion matches the current row', async () => {
    const ctx = { companyId, branchId: undefined as unknown as string, userId: 'test-user' };
    const created = await journalPostingService.createJournalEntry(ctx as never, {
      date: new Date('2026-03-02T00:00:00.000Z'),
      currencyCode: 'SAR',
      description: 'Original 2',
      lines: [
        { accountId: accountA, debit: 200, credit: 0, lineOrder: 1 },
        { accountId: accountB, debit: 0, credit: 200, lineOrder: 2 },
      ],
    });

    const updated = await journalPostingService.updateJournalEntry(ctx as never, created!.id, {
      description: 'Matched version',
      expectedVersion: 0,
    });
    expect(updated?.description).toBe('Matched version');
    expect(updated?.version).toBe(1);
  });
});
