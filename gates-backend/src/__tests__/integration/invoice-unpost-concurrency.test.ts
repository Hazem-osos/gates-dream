/**
 * CC-02: two unpost requests for the same posted invoice must reverse stock,
 * party balance and journals exactly once.
 *
 * Needs a real MySQL database. Skipped unless the DATABASE_URL database name
 * contains "test" so it can never write into a dev or production database.
 *
 * Both calls are held inside `taxPeriodService.assertOpenForDocumentDate`,
 * which `unpost` calls after its friendly `isPosted` pre-check and before its
 * transaction, so both are always past the pre-check. Two release orders:
 *  - overlap: both continue together;
 *  - afterFirstCommit: the second continues only once the first has
 *    committed (a double-click where the second request is a little slower).
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { taxPeriodService } from '../../modules/taxes/services/tax-period.service';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { invoiceM5Service } from '../../modules/invoices/services/invoice-m5.service';
import { invoicePostingOrchestrator } from '../../modules/invoices/services/invoice-posting-orchestrator';
import { invoicePostingContextFromIds } from '../../modules/invoices/services/invoice-posting-context';
import type { InvoicePostingContext } from '../../modules/invoices/types/invoice-posting.types';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = /test/i.test(dbName) ? describe : describe.skip;

const DOC_DATE = new Date('2026-06-15T00:00:00.000Z');
const SEED_QTY = 100;
const SEED_COST = 5;
const QTY = 10;
const PRICE = 20;

/** The loser must be stopped by the invoice claim, not by some unrelated constraint. */
const NOT_POSTED = 'Invoice is not posted';

type Kind = 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PURCHASE_RETURN';
type Mode = 'overlap' | 'afterFirstCommit';

const NUMBER_PREFIX: Record<Kind, string> = {
  SALE: 'SI',
  PURCHASE: 'PI',
  SALE_RETURN: 'SR',
  PURCHASE_RETURN: 'PR',
};

const isSaleSide = (kind: Kind) => kind === 'SALE' || kind === 'SALE_RETURN';

const prisma = new PrismaClient();

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function raceUnpost(ctx: InvoicePostingContext, invoiceId: string, mode: Mode) {
  const original = taxPeriodService.assertOpenForDocumentDate.bind(taxPeriodService);
  let arrived = 0;
  let bothArrived!: () => void;
  const bothHere = new Promise<void>((r) => (bothArrived = r));
  let firstSettled!: () => void;
  const firstDone = new Promise<void>((r) => (firstSettled = r));

  const spy = jest
    .spyOn(taxPeriodService, 'assertOpenForDocumentDate')
    .mockImplementation(async (...args: Parameters<typeof original>) => {
      await original(...args);
      const order = ++arrived;
      if (arrived >= 2) bothArrived();
      await Promise.race([bothHere, wait(5_000)]);
      if (mode === 'afterFirstCommit' && order === 2) {
        await Promise.race([firstDone, wait(30_000)]);
      }
    });

  try {
    const run = () =>
      invoicePostingOrchestrator.unpost(ctx, invoiceId).finally(() => firstSettled());
    const results = await Promise.allSettled([run(), run()]);
    return {
      arrived,
      fulfilled: results.filter((r) => r.status === 'fulfilled').length,
      rejected: results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason))),
    };
  } finally {
    spy.mockRestore();
  }
}

describeDb('CC-02 invoice unpost concurrency (real MySQL)', () => {
  jest.setTimeout(180_000);

  let companyId: string;
  let branchId: string;
  let fiscalYearId: string;
  let warehouseId: string;
  let unitId: string;
  let inventoryAccountId: string;
  let ctx: InvoicePostingContext;
  let seq = 0;

  const suffix = String(Date.now());
  const nextNumber = (prefix: string) => `${prefix}-${suffix}-${++seq}`;

  async function account(code: string, arabicName: string, accountType: string) {
    return prisma.account.create({
      data: { companyId, code, arabicName, accountType, isActive: true },
    });
  }

  /** A stocked item and a fresh party, so every case starts from known balances. */
  async function scenario(kind: Kind) {
    const item = await prisma.item.create({
      data: { companyId, arabicName: `CC02 Item ${nextNumber('I')}` },
    });
    await prisma.itemUnit.create({ data: { itemId: item.id, unitId } });
    await sharedPrisma.$transaction((tx) =>
      inventoryCostingService.applyInboundMovement(tx, {
        companyId,
        branchId,
        itemId: item.id,
        warehouseId,
        quantity: SEED_QTY,
        unitCost: SEED_COST,
        movementType: COSTING_MOVEMENT.PURCHASE,
        sourceType: 'CC02-SEED',
        sourceNumber: item.id.slice(0, 8),
        transactionDate: DOC_DATE,
        updateLastPurchasePrice: false,
      })
    );
    const partyId = isSaleSide(kind)
      ? (
          await prisma.customer.create({
            data: { companyId, arabicName: `CC02 Customer ${nextNumber('C')}`, creditLimit: 1_000_000 },
          })
        ).id
      : (
          await prisma.supplier.create({
            data: { companyId, arabicName: `CC02 Supplier ${nextNumber('S')}` },
          })
        ).id;
    return { kind, itemId: item.id, partyId };
  }

  type Scenario = Awaited<ReturnType<typeof scenario>>;

  async function createAndPost(s: Scenario) {
    const invoice = await invoiceM5Service.create(companyId, branchId, fiscalYearId, {
      invoiceKind: s.kind,
      invoiceNumber: nextNumber(NUMBER_PREFIX[s.kind]),
      date: DOC_DATE,
      currencyCode: 'EGP',
      exchangeRate: 1,
      withholdingTaxAmount: 0,
      sourceYearId: '2026',
      warehouseId,
      paymentMethod: 'credit',
      ...(isSaleSide(s.kind) ? { customerId: s.partyId } : { supplierId: s.partyId }),
      lines: [{ itemId: s.itemId, unitId, quantity: QTY, baseQuantity: QTY, price: PRICE, lineOrder: 1 }],
    } as never);
    const created = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice!.id } });
    if (!created.isPosted) await invoicePostingOrchestrator.post(ctx, invoice!.id);
    return invoice!.id;
  }

  /** Stock, party cache, party ledger and inventory GL cache. */
  async function balances(s: Scenario) {
    const party = isSaleSide(s.kind)
      ? await prisma.customer.findUniqueOrThrow({ where: { id: s.partyId } })
      : await prisma.supplier.findUniqueOrThrow({ where: { id: s.partyId } });
    const onHand = await prisma.itemWarehouseBalance.findUnique({
      where: { companyId_itemId_warehouseId: { companyId, itemId: s.itemId, warehouseId } },
    });
    const partyGl = party.accountId
      ? await prisma.journalEntryLine.aggregate({
          where: {
            accountId: party.accountId,
            journalEntry: { companyId, isPosted: true, deletedAt: null },
          },
          _sum: { debitBase: true, creditBase: true },
        })
      : null;
    const inventoryGl = await prisma.accountPeriodBalance.aggregate({
      where: { companyId, accountId: inventoryAccountId },
      _sum: { netBalance: true },
    });
    const partyGlNet = partyGl
      ? Number(partyGl._sum.debitBase ?? 0) - Number(partyGl._sum.creditBase ?? 0)
      : 0;
    return {
      onHand: Number(onHand?.quantityOnHand ?? 0),
      partyBalance: Number(party.balance),
      // Customer cache = debit − credit; supplier cache = credit − debit.
      partyLedger: isSaleSide(s.kind) ? partyGlNet : -partyGlNet,
      inventoryGl: Number(inventoryGl._sum.netBalance ?? 0),
    };
  }

  async function documentState(invoiceId: string) {
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const sourceJournalIds = [invoice.journalEntryId, invoice.costJournalEntryId].filter(
      (id): id is string => Boolean(id)
    );
    return {
      isPosted: invoice.isPosted,
      version: invoice.version,
      movements: await prisma.inventoryMovement.count({
        where: { companyId, sourceDocumentId: invoiceId },
      }),
      sourceJournals: sourceJournalIds.length,
      reversals: await prisma.journalEntry.count({
        where: { companyId, reversalOfJournalEntryId: { in: sourceJournalIds } },
      }),
    };
  }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { arabicName: `CC02 Invoice ${suffix}`, englishName: `CC02 ${suffix}`, isActive: true },
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { companyId, arabicName: `CC02 Branch ${suffix}` },
    });
    branchId = branch.id;

    const fy = await prisma.fiscalYear.create({
      data: {
        companyId,
        legacyYearId: '2026',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
        status: 'Open',
        isActive: true,
      },
    });
    fiscalYearId = fy.id;

    await account('1200', 'CC02 AR', 'asset');
    inventoryAccountId = (await account('1300', 'CC02 Inventory', 'asset')).id;
    await account('2100', 'CC02 AP', 'liability');
    await account('4100', 'CC02 Sales', 'revenue');
    await account('4200', 'CC02 Sales Returns', 'revenue');
    await account('5100', 'CC02 COGS', 'expense');
    await account('5200', 'CC02 Purchase Returns', 'expense');

    await prisma.companySettings.create({
      data: {
        companyId,
        accountDefinitions: {
          arAccount: '1200',
          apAccount: '2100',
          inventoryAccount: '1300',
          salesRevenueAccount: '4100',
          salesReturnAccount: '4200',
          cogsAccount: '5100',
          purchaseReturnAccount: '5200',
        },
        allowNegativeBalance: true,
      },
    });

    warehouseId = (
      await prisma.warehouse.create({ data: { companyId, arabicName: `CC02 WH ${suffix}` } })
    ).id;
    unitId = (
      await prisma.unit.create({ data: { companyId, arabicName: 'CC02 Unit', code: `U${suffix}` } })
    ).id;

    ctx = invoicePostingContextFromIds({
      companyId,
      branchId,
      fiscalYearId,
      userId: 'cc02-invoice-unpost-test',
    });
    ctx.isAdmin = true;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  it('SALE: a single unpost restores stock, party and ledger', async () => {
    const s = await scenario('SALE');
    const initial = await balances(s);
    const invoiceId = await createAndPost(s);
    const posted = { ...(await documentState(invoiceId)), ...(await balances(s)) };

    await invoicePostingOrchestrator.unpost(ctx, invoiceId);
    const after = { ...(await documentState(invoiceId)), ...(await balances(s)) };

    expect(posted).toMatchObject({ isPosted: true, movements: 1, onHand: SEED_QTY - QTY });
    expect(posted.partyBalance).toBeCloseTo(initial.partyBalance + QTY * PRICE, 4);
    expect(after).toMatchObject({
      isPosted: false,
      version: posted.version,
      movements: 2,
      reversals: 0,
      ...initial,
    });
  });

  it.each<[Kind, Mode]>([
    ['SALE', 'afterFirstCommit'],
    ['SALE', 'overlap'],
    ['PURCHASE', 'afterFirstCommit'],
    ['PURCHASE', 'overlap'],
    ['SALE_RETURN', 'afterFirstCommit'],
    ['PURCHASE_RETURN', 'afterFirstCommit'],
  ])('%s: two unposts (%s) reverse everything exactly once', async (kind, mode) => {
    const s = await scenario(kind);
    const initial = await balances(s);
    const invoiceId = await createAndPost(s);
    const posted = { ...(await documentState(invoiceId)), ...(await balances(s)) };

    const outcome = await raceUnpost(ctx, invoiceId, mode);
    const after = { ...(await documentState(invoiceId)), ...(await balances(s)) };

    console.log(`[CC-02] ${kind} ${mode}`, JSON.stringify({ initial, posted, outcome, after }));

    expect(outcome.arrived).toBe(2);
    expect({ fulfilled: outcome.fulfilled, rejected: outcome.rejected }).toEqual({
      fulfilled: 1,
      rejected: [NOT_POSTED],
    });
    expect(after).toMatchObject({
      isPosted: false,
      movements: posted.movements * 2,
      reversals: 0,
      ...initial,
    });
  });

  it.each<Kind>(['SALE', 'PURCHASE'])(
    '%s: post → unpost → repost → unpost applies and reverses once per cycle',
    async (kind) => {
      const s = await scenario(kind);
      const initial = await balances(s);
      const invoiceId = await createAndPost(s);
      const postedBalances = await balances(s);

      await invoicePostingOrchestrator.unpost(ctx, invoiceId);
      expect(await documentState(invoiceId)).toMatchObject({ isPosted: false, movements: 2 });
      expect(await balances(s)).toEqual(initial);

      await invoicePostingOrchestrator.post(ctx, invoiceId);
      expect(await documentState(invoiceId)).toMatchObject({ isPosted: true, movements: 3 });
      expect(await balances(s)).toEqual(postedBalances);

      await invoicePostingOrchestrator.unpost(ctx, invoiceId);
      const final = await documentState(invoiceId);
      expect(final).toMatchObject({ isPosted: false, movements: 4, reversals: 0 });
      expect(await balances(s)).toEqual(initial);
    }
  );
});
