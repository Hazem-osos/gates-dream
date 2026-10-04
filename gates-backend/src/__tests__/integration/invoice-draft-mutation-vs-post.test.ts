/**
 * CC-06: a draft mutation (edit / cancel / delete) that was validated against
 * the draft must not change an invoice that has been posted in the meantime,
 * and a post must not book a revision that an edit has since replaced.
 *
 * Needs a real MySQL database. Skipped unless the DATABASE_URL database name
 * contains "test" so it can never write into a dev or production database.
 *
 * Each race holds the FIRST call of a helper the slow request runs after its
 * friendly state checks and before its transaction, runs the competing request
 * to completion, then releases the slow one:
 *  - edit:            fiscalYearService.assertOpenForDate
 *  - post:            taxPeriodService.assertOpenForDocumentDate
 *  - cancel / delete: prisma.$transaction (nothing is awaited in between)
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { fiscalYearService } from '../../modules/platform/services/fiscal-year.service';
import { taxPeriodService } from '../../modules/taxes/services/tax-period.service';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { invoiceM5Service } from '../../modules/invoices/services/invoice-m5.service';
import { invoicePostingOrchestrator } from '../../modules/invoices/services/invoice-posting-orchestrator';
import { invoicePostingContextFromIds } from '../../modules/invoices/services/invoice-posting-context';
import { invoiceService } from '../../modules/inventory/services/invoice.service';
import type { InvoicePostingContext } from '../../modules/invoices/types/invoice-posting.types';
import { OPTIMISTIC_LOCK_AR } from '../../shared/concurrency/optimistic-lock';

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
const PRICE = 20;
const QTY = 10;
const EDITED_QTY = 20;

type Kind = 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PURCHASE_RETURN';

const NUMBER_PREFIX: Record<Kind, string> = {
  SALE: 'SI',
  PURCHASE: 'PI',
  SALE_RETURN: 'SR',
  PURCHASE_RETURN: 'PR',
};

const isSaleSide = (kind: Kind) => kind === 'SALE' || kind === 'SALE_RETURN';
/** Stock delta a posted invoice of this kind applies per unit. */
const stockSign = (kind: Kind) => (kind === 'PURCHASE' || kind === 'SALE_RETURN' ? 1 : -1);
/** Party-cache delta a posted invoice of this kind applies per currency unit. */
const partySign = (kind: Kind) => (kind === 'SALE' || kind === 'PURCHASE' ? 1 : -1);

const prisma = new PrismaClient();

type Settled<T> = { ok: true; value: T } | { ok: false; error: string };
const settle = <T>(p: Promise<T>): Promise<Settled<T>> =>
  p.then(
    (value) => ({ ok: true as const, value }),
    (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) })
  );

/** Hold the first call of `obj[method]` (after it ran, or before for $transaction). */
function holdFirstCall(obj: object, method: string, runOriginalFirst: boolean) {
  const target = obj as Record<string, (...args: unknown[]) => unknown>;
  const original = target[method];
  let calls = 0;
  let signalArrived!: () => void;
  const arrived = new Promise<void>((r) => (signalArrived = r));
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));
  const spy = jest.spyOn(target, method).mockImplementation(async (...args: unknown[]) => {
    if (++calls !== 1) return original.apply(obj, args);
    const result = runOriginalFirst ? await original.apply(obj, args) : undefined;
    signalArrived();
    await released;
    return runOriginalFirst ? result : original.apply(obj, args);
  });
  return {
    arrived,
    release: () => {
      release();
      spy.mockRestore();
    },
  };
}

describeDb('CC-06 invoice draft mutation vs post (real MySQL)', () => {
  jest.setTimeout(180_000);

  let companyId: string;
  let branchId: string;
  let fiscalYearId: string;
  let warehouseId: string;
  let unitId: string;
  let ctx: InvoicePostingContext;
  let seq = 0;

  const suffix = String(Date.now());
  const nextNumber = (prefix: string) => `${prefix}-${suffix}-${++seq}`;

  async function account(code: string, arabicName: string, accountType: string) {
    return prisma.account.create({
      data: { companyId, code, arabicName, accountType, isActive: true },
    });
  }

  /** A stocked item, a fresh party and a DRAFT invoice for QTY × PRICE. */
  async function draft(kind: Kind) {
    const item = await prisma.item.create({
      data: { companyId, arabicName: `CC06 Item ${nextNumber('I')}` },
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
        sourceType: 'CC06-SEED',
        sourceNumber: item.id.slice(0, 8),
        transactionDate: DOC_DATE,
        updateLastPurchasePrice: false,
      })
    );
    const partyId = isSaleSide(kind)
      ? (
          await prisma.customer.create({
            data: { companyId, arabicName: `CC06 Customer ${nextNumber('C')}`, creditLimit: 1_000_000 },
          })
        ).id
      : (
          await prisma.supplier.create({
            data: { companyId, arabicName: `CC06 Supplier ${nextNumber('S')}` },
          })
        ).id;
    const invoiceNumber = nextNumber(NUMBER_PREFIX[kind]);
    const invoice = await invoiceM5Service.create(companyId, branchId, fiscalYearId, {
      invoiceKind: kind,
      invoiceNumber,
      date: DOC_DATE,
      currencyCode: 'EGP',
      exchangeRate: 1,
      withholdingTaxAmount: 0,
      sourceYearId: '2026',
      warehouseId,
      paymentMethod: 'credit',
      ...(isSaleSide(kind) ? { customerId: partyId } : { supplierId: partyId }),
      lines: [lineInput(item.id, QTY)],
    } as never);
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice!.id } });
    expect(row.isPosted).toBe(false);
    return { kind, id: row.id, invoiceNumber, itemId: item.id, partyId, version: row.version };
  }

  type Draft = Awaited<ReturnType<typeof draft>>;

  function lineInput(itemId: string, quantity: number) {
    return { itemId, unitId, quantity, baseQuantity: quantity, price: PRICE, lineOrder: 1 };
  }

  const editTo = (d: Draft, quantity: number, expectedVersion = d.version) =>
    invoiceM5Service.update(companyId, d.id, {
      expectedVersion,
      lines: [lineInput(d.itemId, quantity)],
    } as never);

  /** Invoice row, its ledger/stock footprint and the party caches. */
  async function state(d: Draft) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: d.id },
      include: { lines: true },
    });
    const party = isSaleSide(d.kind)
      ? await prisma.customer.findUniqueOrThrow({ where: { id: d.partyId } })
      : await prisma.supplier.findUniqueOrThrow({ where: { id: d.partyId } });
    const partyGl = party.accountId
      ? await prisma.journalEntryLine.aggregate({
          where: {
            accountId: party.accountId,
            journalEntry: { companyId, isPosted: true, deletedAt: null },
          },
          _sum: { debitBase: true, creditBase: true },
        })
      : null;
    const partyGlNet = partyGl
      ? Number(partyGl._sum.debitBase ?? 0) - Number(partyGl._sum.creditBase ?? 0)
      : 0;
    const journals = await prisma.journalEntry.findMany({
      where: { companyId, sourceNumber: d.invoiceNumber, reversalOfJournalEntryId: null },
      select: { id: true },
    });
    const onHand = await prisma.itemWarehouseBalance.findUnique({
      where: { companyId_itemId_warehouseId: { companyId, itemId: d.itemId, warehouseId } },
    });
    return {
      exists: invoice !== null,
      isPosted: invoice?.isPosted ?? null,
      isCancelled: invoice?.isCancelled ?? null,
      version: invoice?.version ?? null,
      lineQty: invoice?.lines.reduce((s, l) => s + Number(l.quantity), 0) ?? null,
      netAmount: invoice ? Number(invoice.netAmount) : null,
      journals: journals.length,
      reversals: await prisma.journalEntry.count({
        where: { companyId, reversalOfJournalEntryId: { in: journals.map((j) => j.id) } },
      }),
      movements: await prisma.inventoryMovement.count({
        where: { companyId, sourceDocumentId: d.id },
      }),
      onHand: Number(onHand?.quantityOnHand ?? 0),
      partyBalance: Number(party.balance),
      // Customer cache = debit − credit; supplier cache = credit − debit.
      partyLedger: (isSaleSide(d.kind) ? partyGlNet : -partyGlNet) || 0,
    };
  }

  /** What a correctly posted invoice of `qty` units looks like. */
  function postedFor(d: Draft, qty: number) {
    return {
      exists: true,
      isPosted: true,
      isCancelled: false,
      lineQty: qty,
      netAmount: qty * PRICE,
      movements: 1,
      onHand: SEED_QTY + stockSign(d.kind) * qty,
      partyBalance: partySign(d.kind) * qty * PRICE,
      partyLedger: partySign(d.kind) * qty * PRICE,
    };
  }

  /** A draft that never touched stock, party or ledger. */
  function untouchedDraft(qty: number) {
    return {
      exists: true,
      isPosted: false,
      lineQty: qty,
      netAmount: qty * PRICE,
      movements: 0,
      onHand: SEED_QTY,
      partyBalance: 0,
      partyLedger: 0,
    };
  }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { arabicName: `CC06 Invoice ${suffix}`, englishName: `CC06 ${suffix}`, isActive: true },
    });
    companyId = company.id;

    branchId = (
      await prisma.branch.create({ data: { companyId, arabicName: `CC06 Branch ${suffix}` } })
    ).id;

    fiscalYearId = (
      await prisma.fiscalYear.create({
        data: {
          companyId,
          legacyYearId: '2026',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.000Z'),
          status: 'Open',
          isActive: true,
        },
      })
    ).id;

    await account('1200', 'CC06 AR', 'asset');
    await account('1300', 'CC06 Inventory', 'asset');
    await account('2100', 'CC06 AP', 'liability');
    await account('4100', 'CC06 Sales', 'revenue');
    await account('4200', 'CC06 Sales Returns', 'revenue');
    await account('5100', 'CC06 COGS', 'expense');
    await account('5200', 'CC06 Purchase Returns', 'expense');

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
        // Keep saved invoices as drafts; posting is always explicit here.
        autoPostGl: false,
      },
    });

    warehouseId = (
      await prisma.warehouse.create({ data: { companyId, arabicName: `CC06 WH ${suffix}` } })
    ).id;
    unitId = (
      await prisma.unit.create({ data: { companyId, arabicName: 'CC06 Unit', code: `U${suffix}` } })
    ).id;

    ctx = invoicePostingContextFromIds({ companyId, branchId, fiscalYearId, userId: 'cc06-test' });
    ctx.isAdmin = true;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  it('A. a normal draft edit still succeeds and bumps the version', async () => {
    const d = await draft('SALE');
    await editTo(d, EDITED_QTY);
    expect(await state(d)).toMatchObject({ ...untouchedDraft(EDITED_QTY), version: d.version + 1 });
  });

  it('B. a stale edit after another edit is still rejected (409)', async () => {
    const d = await draft('SALE');
    await editTo(d, EDITED_QTY);
    const stale = await settle(editTo(d, 30));
    expect(stale).toEqual({ ok: false, error: OPTIMISTIC_LOCK_AR });
    expect(await state(d)).toMatchObject(untouchedDraft(EDITED_QTY));
  });

  it.each<Kind>(['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN'])(
    'C. %s: edit validated on the draft, post commits, edit resumes → edit rejected',
    async (kind) => {
      const d = await draft(kind);
      const hold = holdFirstCall(fiscalYearService, 'assertOpenForDate', true);
      const edit = settle(editTo(d, EDITED_QTY));
      await hold.arrived;
      const post = await settle(invoicePostingOrchestrator.post(ctx, d.id));
      hold.release();
      const editResult = await edit;
      const after = await state(d);

      console.log(`[CC-06] C ${kind}`, JSON.stringify({ post: post.ok, edit: editResult, after }));

      expect(post.ok).toBe(true);
      expect(editResult).toEqual({ ok: false, error: OPTIMISTIC_LOCK_AR });
      expect(after).toMatchObject(postedFor(d, QTY));
    }
  );

  // SALE_RETURN does not rewrite line costs during post, so a replaced line set
  // is not caught by an accidental "record not found" on the old line ids.
  it.each<Kind>(['SALE', 'PURCHASE', 'SALE_RETURN'])(
    'D. %s: post loaded the draft, edit commits, post resumes → post rejected',
    async (kind) => {
      const d = await draft(kind);
      const hold = holdFirstCall(taxPeriodService, 'assertOpenForDocumentDate', true);
      const post = settle(invoicePostingOrchestrator.post(ctx, d.id));
      await hold.arrived;
      const edit = await settle(editTo(d, EDITED_QTY));
      hold.release();
      const postResult = await post;
      const after = await state(d);

      console.log(`[CC-06] D ${kind}`, JSON.stringify({ edit: edit.ok, post: postResult, after }));

      expect(edit.ok).toBe(true);
      expect(postResult).toEqual({ ok: false, error: OPTIMISTIC_LOCK_AR });
      expect(after).toMatchObject({ ...untouchedDraft(EDITED_QTY), journals: 0 });

      // The edited revision is then posted normally.
      await invoicePostingOrchestrator.post(ctx, d.id);
      expect(await state(d)).toMatchObject(postedFor(d, EDITED_QTY));
    }
  );

  it('D. header-only edit (new customer) commits while post is loaded → post rejected', async () => {
    const d = await draft('SALE');
    const other = await prisma.customer.create({
      data: { companyId, arabicName: `CC06 Customer ${nextNumber('C')}`, creditLimit: 1_000_000 },
    });
    const hold = holdFirstCall(taxPeriodService, 'assertOpenForDocumentDate', true);
    const post = settle(invoicePostingOrchestrator.post(ctx, d.id));
    await hold.arrived;
    const edit = await settle(
      invoiceM5Service.update(companyId, d.id, {
        expectedVersion: d.version,
        customerId: other.id,
      } as never)
    );
    hold.release();
    const postResult = await post;

    const customerBalance = async (id: string) =>
      Number((await prisma.customer.findUniqueOrThrow({ where: { id } })).balance);
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: d.id } });
    const after = {
      isPosted: row.isPosted,
      invoiceCustomerIsNew: row.customerId === other.id,
      oldCustomerBalance: await customerBalance(d.partyId),
      newCustomerBalance: await customerBalance(other.id),
    };

    console.log('[CC-06] D header', JSON.stringify({ edit: edit.ok, post: postResult, after }));

    expect(edit.ok).toBe(true);
    expect(postResult).toEqual({ ok: false, error: OPTIMISTIC_LOCK_AR });
    expect(after).toEqual({
      isPosted: false,
      invoiceCustomerIsNew: true,
      oldCustomerBalance: 0,
      newCustomerBalance: 0,
    });

    await invoicePostingOrchestrator.post(ctx, d.id);
    expect(await customerBalance(other.id)).toBe(QTY * PRICE);
    expect(await customerBalance(d.partyId)).toBe(0);
  });

  it('E. cancel validated on the draft, post commits, cancel resumes → cancel rejected', async () => {
    const d = await draft('SALE');
    const hold = holdFirstCall(sharedPrisma, '$transaction', false);
    const cancel = settle(invoiceM5Service.cancel(companyId, d.id, 'cc06-test'));
    await hold.arrived;
    const post = await settle(invoicePostingOrchestrator.post(ctx, d.id));
    hold.release();
    const cancelResult = await cancel;
    const after = await state(d);

    console.log('[CC-06] E cancel', JSON.stringify({ post: post.ok, cancel: cancelResult, after }));

    expect(post.ok).toBe(true);
    expect(cancelResult).toEqual({ ok: false, error: 'Unpost the invoice before cancelling it' });
    expect(after).toMatchObject({ ...postedFor(d, QTY), reversals: 0 });
  });

  it('F. delete validated on the draft, post commits, delete resumes → delete rejected', async () => {
    const d = await draft('SALE');
    const hold = holdFirstCall(sharedPrisma, '$transaction', false);
    const remove = settle(invoiceM5Service.remove(companyId, d.id));
    await hold.arrived;
    const post = await settle(invoicePostingOrchestrator.post(ctx, d.id));
    hold.release();
    const removeResult = await remove;
    const after = await state(d);

    console.log('[CC-06] F delete', JSON.stringify({ post: post.ok, remove: removeResult, after }));

    expect(post.ok).toBe(true);
    expect(removeResult).toEqual({
      ok: false,
      error: 'Posted invoices cannot be deleted — unpost or cancel instead',
    });
    expect(after).toMatchObject(postedFor(d, QTY));
  });

  it('legacy update validated on the draft, post commits, update resumes → rejected', async () => {
    const d = await draft('SALE');
    const hold = holdFirstCall(fiscalYearService, 'assertOpenForDate', true);
    const edit = settle(
      invoiceService.updateInvoice(companyId, d.id, {
        expectedVersion: d.version,
        lines: [lineInput(d.itemId, EDITED_QTY)],
      } as never)
    );
    await hold.arrived;
    const post = await settle(invoicePostingOrchestrator.post(ctx, d.id));
    hold.release();
    const editResult = await edit;
    const after = await state(d);

    console.log('[CC-06] legacy update', JSON.stringify({ post: post.ok, edit: editResult, after }));

    expect(post.ok).toBe(true);
    expect(editResult).toEqual({ ok: false, error: OPTIMISTIC_LOCK_AR });
    expect(after).toMatchObject(postedFor(d, QTY));
  });

  it('legacy delete (soft) validated on the draft, post commits, delete resumes → rejected', async () => {
    const d = await draft('SALE');
    const hold = holdFirstCall(sharedPrisma, '$transaction', false);
    const remove = settle(invoiceService.deleteInvoice(companyId, d.id));
    await hold.arrived;
    const post = await settle(invoicePostingOrchestrator.post(ctx, d.id));
    hold.release();
    const removeResult = await remove;
    const after = await state(d);

    console.log('[CC-06] legacy delete', JSON.stringify({ post: post.ok, remove: removeResult, after }));

    expect(post.ok).toBe(true);
    expect(removeResult).toEqual({ ok: false, error: 'Cannot delete a posted invoice' });
    expect(after).toMatchObject({ ...postedFor(d, QTY), reversals: 0 });
  });

  it('legacy cancel validated on the draft, post commits, cancel resumes → rejected', async () => {
    const d = await draft('PURCHASE');
    const hold = holdFirstCall(sharedPrisma, '$transaction', false);
    const cancel = settle(invoiceService.cancelInvoice(companyId, d.id));
    await hold.arrived;
    const post = await settle(invoicePostingOrchestrator.post(ctx, d.id));
    hold.release();
    const cancelResult = await cancel;
    const after = await state(d);

    console.log('[CC-06] legacy cancel', JSON.stringify({ post: post.ok, cancel: cancelResult, after }));

    expect(post.ok).toBe(true);
    expect(cancelResult).toEqual({
      ok: false,
      error: 'Cannot cancel a posted invoice. Unpost it first, or create a return invoice.',
    });
    expect(after).toMatchObject({ ...postedFor(d, QTY), reversals: 0 });
  });

  it('G. draft → edit → post → unpost → edit → repost keeps working', async () => {
    const d = await draft('SALE');
    await editTo(d, 15);
    let row = await prisma.invoice.findUniqueOrThrow({ where: { id: d.id } });

    await invoicePostingOrchestrator.post(ctx, d.id);
    expect(await state(d)).toMatchObject({ ...postedFor(d, 15), version: row.version });

    await invoicePostingOrchestrator.unpost(ctx, d.id);
    expect(await state(d)).toMatchObject({
      isPosted: false,
      lineQty: 15,
      onHand: SEED_QTY,
      partyBalance: 0,
      partyLedger: 0,
    });

    row = await prisma.invoice.findUniqueOrThrow({ where: { id: d.id } });
    await editTo({ ...d, version: row.version }, EDITED_QTY);
    await invoicePostingOrchestrator.post(ctx, d.id);
    expect(await state(d)).toMatchObject({
      isPosted: true,
      lineQty: EDITED_QTY,
      netAmount: EDITED_QTY * PRICE,
      movements: 3,
      onHand: SEED_QTY - EDITED_QTY,
      partyBalance: EDITED_QTY * PRICE,
      partyLedger: EDITED_QTY * PRICE,
    });
  });
});
