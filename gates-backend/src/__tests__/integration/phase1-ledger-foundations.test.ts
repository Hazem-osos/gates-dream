/**
 * Phase 1 ledger foundations: uniqueness, contra reversal, VAT mapping, period lock.
 * Requires Wave1 fixture company. Skips when the DB is not seeded.
 */
import { config as loadEnv } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';
import {
  PERIOD_LOCKED_MESSAGE,
  VAT_ACCOUNT_UNMAPPED_MESSAGE,
} from '../../modules/accounting/constants/ledger-integrity';
import { invoiceM5Service } from '../../modules/invoices/services/invoice-m5.service';
import { invoicePostingOrchestrator } from '../../modules/invoices/services/invoice-posting-orchestrator';
import { invoicePostingContextFromIds } from '../../modules/invoices/services/invoice-posting-context';
import { AppError } from '../../shared/middleware/error-handler';

loadEnv({ override: true });

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const ITEM_ID = '00000000-0000-0000-0000-000000000040';
const UNIT_ID = '00000000-0000-0000-0000-000000000041';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';

async function companyReady(): Promise<boolean> {
  try {
    const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
    return !!company;
  } catch {
    return false;
  }
}

async function ensureAccount(code: string, arabicName: string, type: string) {
  const existing = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code },
  });
  if (existing) return existing;
  return prisma.account.create({
    data: { companyId: COMPANY_ID, code, arabicName, accountType: type, isActive: true },
  });
}

describe('phase1-ledger-foundations', () => {
  jest.setTimeout(60_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects duplicate account codes in the same company (P2002/409)', async () => {
    if (!(await companyReady())) {
      console.warn('Skip: Wave1 fixture company not seeded.');
      return;
    }

    const code = `DUP-${Date.now().toString(36)}`;
    await prisma.account.create({
      data: {
        companyId: COMPANY_ID,
        code,
        arabicName: 'Duplicate probe',
        accountType: 'asset',
        isActive: true,
      },
    });

    try {
      await prisma.account.create({
        data: {
          companyId: COMPANY_ID,
          code,
          arabicName: 'Duplicate probe 2',
          accountType: 'asset',
          isActive: true,
        },
      });
      throw new Error('expected unique constraint on (companyId, code)');
    } catch (e) {
      expect(e).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((e as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
    }
  });

  it('reverses a posted JE with a contra entry and leaves the original posted', async () => {
    if (!(await companyReady())) return;

    const cash = await ensureAccount('1100', 'Cash', 'asset');
    const ar = await ensureAccount('1200', 'AR', 'asset');
    const fy = await prisma.fiscalYear.findFirst({
      where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
    });
    expect(fy).toBeTruthy();

    const ctx = {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      fiscalYearId: fy!.id,
      userId: 'phase1-ledger-test',
    };

    const { originalId, reversalId } = await prisma.$transaction(async (tx) => {
      const original = await journalPostingService.createAndPostInTx(tx, ctx, {
        date: new Date(),
        description: 'Phase1 contra probe 5000',
        currencyCode: 'EGP',
        fiscalYearId: fy!.id,
        entryType: 'MANUAL',
        sourceType: 'TST',
        sourceNumber: `P1-${Date.now().toString(36)}`.slice(0, 20),
        sourceYearId: fy!.legacyYearId,
        lines: [
          { accountId: ar.id, debit: 5000, credit: 0, lineOrder: 1 },
          { accountId: cash.id, debit: 0, credit: 5000, lineOrder: 2 },
        ],
      });

      const { original: stillPosted, reversal } =
        await journalPostingService.reverseJournalEntryInTx(tx, ctx, original.id, {
          reason: 'اختبار عكسي',
        });

      return { originalId: stillPosted.id, reversalId: reversal.id };
    });

    const original = await prisma.journalEntry.findUnique({
      where: { id: originalId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    const reversal = await prisma.journalEntry.findUnique({
      where: { id: reversalId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });

    expect(original!.isPosted).toBe(true);
    expect(reversal!.isPosted).toBe(true);
    expect(reversal!.reversalOfJournalEntryId).toBe(original!.id);
    expect(reversal!.description).toMatch(/قيد عكسي/);

    expect(reversal!.lines).toHaveLength(original!.lines.length);
    for (let i = 0; i < original!.lines.length; i++) {
      expect(Number(reversal!.lines[i].debit)).toBeCloseTo(Number(original!.lines[i].credit), 4);
      expect(Number(reversal!.lines[i].credit)).toBeCloseTo(Number(original!.lines[i].debit), 4);
    }

    const netDebit =
      [...original!.lines, ...reversal!.lines].reduce((s, l) => s + Number(l.debit), 0);
    const netCredit =
      [...original!.lines, ...reversal!.lines].reduce((s, l) => s + Number(l.credit), 0);
    expect(netDebit).toBeCloseTo(netCredit, 4);
    expect(netDebit).toBeCloseTo(10000, 4);
  });

  it('throws 422 and writes no GL when VAT is unmapped on a taxed invoice', async () => {
    if (!(await companyReady())) return;

    await ensureAccount('1100', 'Cash', 'asset');
    await ensureAccount('1200', 'AR', 'asset');
    await ensureAccount('1300', 'Inventory', 'asset');
    await ensureAccount('4100', 'Sales', 'revenue');
    await ensureAccount('5100', 'COGS', 'expense');

    const settings = await prisma.companySettings.findUnique({
      where: { companyId: COMPANY_ID },
    });
    const previousDefs = (settings?.accountDefinitions as Record<string, string>) ?? {};
    await prisma.companySettings.update({
      where: { companyId: COMPANY_ID },
      data: {
        accountDefinitions: {
          ...previousDefs,
          cashAccount: '1100',
          arAccount: '1200',
          inventoryAccount: '1300',
          salesRevenueAccount: '4100',
          cogsAccount: '5100',
          vatOutputAccount: '',
          salesTaxAccount: '',
        },
        allowNegativeBalance: true,
      },
    });

    const fy = await prisma.fiscalYear.findFirst({
      where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
    });
    const ctx = invoicePostingContextFromIds({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      fiscalYearId: fy!.id,
      userId: 'phase1-vat-test',
    });

    const invoice = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fy!.id, {
      invoiceKind: 'SALE',
      date: new Date(),
      currencyCode: 'EGP',
      exchangeRate: 1,
      withholdingTaxAmount: 0,
      customerId: CUSTOMER_ID,
      warehouseId: WAREHOUSE_ID,
      sourceYearId: fy!.legacyYearId,
      paymentMethod: 'credit',
      lines: [
        {
          itemId: ITEM_ID,
          unitId: UNIT_ID,
          quantity: 1,
          baseQuantity: 1,
          price: 1000,
          taxPercent: 14,
          lineOrder: 1,
        },
      ],
    });

    const jeBefore = await prisma.journalEntry.count({ where: { companyId: COMPANY_ID } });

    try {
      try {
        await invoicePostingOrchestrator.post(ctx, invoice!.id);
        throw new Error('expected VAT mapping failure');
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).statusCode).toBe(422);
        expect((e as AppError).message).toBe(VAT_ACCOUNT_UNMAPPED_MESSAGE);
      }

      const posted = await prisma.invoice.findUnique({ where: { id: invoice!.id } });
      expect(posted!.isPosted).toBe(false);
      const jeAfter = await prisma.journalEntry.count({ where: { companyId: COMPANY_ID } });
      expect(jeAfter).toBe(jeBefore);
    } finally {
      await prisma.companySettings.update({
        where: { companyId: COMPANY_ID },
        data: { accountDefinitions: previousDefs },
      });
    }
  });

  it('throws 422 when posting into a closed fiscal period', async () => {
    if (!(await companyReady())) return;

    const cash = await ensureAccount('1100', 'Cash', 'asset');
    const ar = await ensureAccount('1200', 'AR', 'asset');

    const lockedYear = await prisma.fiscalYear.create({
      data: {
        companyId: COMPANY_ID,
        legacyYearId: `L${Date.now().toString(36)}`.slice(0, 12),
        arabicName: 'Phase1 lock year',
        startDate: new Date('2099-01-01'),
        endDate: new Date('2099-12-31'),
        status: 'Open',
        isActive: true,
      },
    });
    await prisma.fiscalPeriod.create({
      data: {
        companyId: COMPANY_ID,
        fiscalYearId: lockedYear.id,
        periodNumber: 1,
        name: 'Locked Jan 2099',
        startDate: new Date('2099-01-01'),
        endDate: new Date('2099-01-31'),
        isClosed: true,
      },
    });

    const ctx = {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      fiscalYearId: lockedYear.id,
      userId: 'phase1-period-lock',
    };

    try {
      await prisma.$transaction(async (tx) => {
        await journalPostingService.createAndPostInTx(tx, ctx, {
          date: new Date('2099-01-15'),
          description: 'Should fail — closed period',
          currencyCode: 'EGP',
          fiscalYearId: lockedYear.id,
          entryType: 'MANUAL',
          lines: [
            { accountId: ar.id, debit: 10, credit: 0, lineOrder: 1 },
            { accountId: cash.id, debit: 0, credit: 10, lineOrder: 2 },
          ],
        });
      });
      throw new Error('expected closed-period failure');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(422);
      expect((e as AppError).message).toBe(PERIOD_LOCKED_MESSAGE);
    }
  });
});
