/**
 * H-03: editing a posted cash voucher must update the voucher and rewrite its
 * journal, fund balance and party balance together, or change nothing.
 *
 * Drives the real `PATCH /treasury/cash-transactions/:id` route (only auth,
 * permission and tenant/fiscal header middleware are stubbed) against a real
 * MySQL database. Skipped unless the DATABASE_URL database name contains
 * "test" so it can never write into a dev or production database.
 */
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { PrismaClient } from '@prisma/client';

const mockRequestContext = { companyId: '', branchId: '', fiscalYearId: '', userId: '' };

jest.mock('../../shared/middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: unknown, next: () => void) => {
    req.user = { sub: mockRequestContext.userId, realm_access: { roles: [] } };
    next();
  },
}));
jest.mock('../../shared/middleware/authorize.middleware', () => ({
  authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../shared/middleware/tenant-fiscal-context.middleware', () => ({
  tenantAndFiscalContextMiddleware: (req: any, _res: unknown, next: () => void) => {
    req.companyId = mockRequestContext.companyId;
    req.branchId = mockRequestContext.branchId;
    req.fiscalYearId = mockRequestContext.fiscalYearId;
    next();
  },
}));

import sharedPrisma from '../../shared/database/prisma';
import cashTransactionRoutes from '../../modules/treasury/routes/cash-transaction.routes';
import { errorHandler } from '../../shared/middleware/error-handler';
import { cashTransactionService } from '../../modules/treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../../modules/treasury/services/treasury-posting.service';
import type { TreasuryPostingContext } from '../../modules/treasury/types/treasury.types';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = /test/i.test(dbName) ? describe : describe.skip;

const VOUCHER_DATE = new Date('2026-06-15T00:00:00.000Z');
const OPENING_CASH = 1000;
const PAYMENT = 300;

const prisma = new PrismaClient();

describeDb('H-03 posted cash voucher edit is atomic (real MySQL)', () => {
  jest.setTimeout(120_000);

  let server: Server;
  let baseUrl: string;
  let companyId: string;
  let safeId: string;
  let safeAccountId: string;
  let supplierId: string;
  let supplierAccountId: string;
  let revenueAccountId: string;
  let ctx: TreasuryPostingContext;
  let seq = 0;

  const voucherNumber = () => `H03${Date.now() % 1_000_000}${++seq}`;

  function paymentBody(amount: number, extra: Record<string, unknown> = {}) {
    return {
      transactionKind: 'PAYMENT',
      date: VOUCHER_DATE.toISOString(),
      description: `H03 payment ${amount}`,
      amount,
      currencyCode: 'EGP',
      supplierId,
      safeId,
      lines: [{ accountId: supplierAccountId, amount, entrySide: 'DEBIT' }],
      ...extra,
    };
  }

  async function createPayment(amount: number) {
    const created = await cashTransactionService.create(
      companyId,
      ctx.branchId,
      ctx.fiscalYearId,
      { ...(paymentBody(amount) as any), date: VOUCHER_DATE, voucherNumber: voucherNumber() },
      ctx.userId
    );
    return created.id as string;
  }

  async function patchVoucher(id: string, body: Record<string, unknown>) {
    const res = await fetch(`${baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  }

  async function snapshot(id: string) {
    const voucher = await prisma.cashTransaction.findUniqueOrThrow({
      where: { id },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    const [safe, supplier, journalEntries, safeLedger, safePeriod, supplierRunning] =
      await Promise.all([
        prisma.safe.findUniqueOrThrow({ where: { id: safeId }, select: { balance: true } }),
        prisma.supplier.findUniqueOrThrow({ where: { id: supplierId }, select: { balance: true } }),
        prisma.journalEntry.count({ where: { companyId } }),
        prisma.journalEntryLine.aggregate({
          where: {
            accountId: safeAccountId,
            journalEntry: { companyId, isPosted: true, isCancelled: false, deletedAt: null },
          },
          _sum: { debitBase: true, creditBase: true },
        }),
        prisma.accountPeriodBalance.aggregate({
          where: { companyId, accountId: safeAccountId },
          _sum: { netBalance: true },
        }),
        prisma.partnerRunningBalance.aggregate({
          where: { companyId, partnerId: supplierId },
          _sum: { netBase: true },
        }),
      ]);
    return {
      voucherAmount: Number(voucher.amount),
      voucherVersion: voucher.version,
      voucherLineAmounts: voucher.lines.map((l) => Number(l.amount)),
      isPosted: voucher.isPosted,
      journalEntryId: voucher.journalEntryId,
      journalEntries,
      safeBalance: Number(safe.balance),
      safeLedgerNet:
        Number(safeLedger._sum.debitBase ?? 0) - Number(safeLedger._sum.creditBase ?? 0),
      safePeriodNet: Number(safePeriod._sum.netBalance ?? 0),
      supplierBalance: Number(supplier.balance),
      supplierRunningNet: Number(supplierRunning._sum.netBase ?? 0),
    };
  }

  async function setPreventOverdraft(on: boolean) {
    await prisma.companySettings.update({
      where: { companyId },
      data: { preventCashOverdraft: on },
    });
  }

  beforeAll(async () => {
    const suffix = String(Date.now());
    const company = await prisma.company.create({
      data: { arabicName: `H03 ${suffix}`, englishName: `H03 ${suffix}`, isActive: true },
    });
    companyId = company.id;
    await prisma.companySettings.create({ data: { companyId } });

    const branch = await prisma.branch.create({
      data: { companyId, arabicName: `H03 Branch ${suffix}` },
    });
    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        companyId,
        legacyYearId: '2026',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
        status: 'Open',
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        companyId,
        email: `h03-${suffix}@example.test`,
        username: `h03-${suffix}`,
        passwordHash: 'not-a-real-hash',
      },
    });

    const [safeAccount, supplierAccount, revenueAccount] = await Promise.all([
      prisma.account.create({
        data: { companyId, code: `H03C${suffix}`, arabicName: 'خزينة', accountType: 'asset' },
      }),
      prisma.account.create({
        data: { companyId, code: `H03S${suffix}`, arabicName: 'موردين', accountType: 'liability' },
      }),
      prisma.account.create({
        data: { companyId, code: `H03R${suffix}`, arabicName: 'إيرادات', accountType: 'revenue' },
      }),
    ]);
    safeAccountId = safeAccount.id;
    supplierAccountId = supplierAccount.id;
    revenueAccountId = revenueAccount.id;

    const safe = await prisma.safe.create({
      data: { companyId, arabicName: `H03 Safe ${suffix}`, currencyCode: 'EGP', glAccountId: safeAccountId },
    });
    safeId = safe.id;
    const supplier = await prisma.supplier.create({
      data: { companyId, arabicName: `H03 Supplier ${suffix}`, accountId: supplierAccountId },
    });
    supplierId = supplier.id;

    mockRequestContext.companyId = companyId;
    mockRequestContext.branchId = branch.id;
    mockRequestContext.fiscalYearId = fiscalYear.id;
    mockRequestContext.userId = user.id;
    ctx = {
      companyId,
      branchId: branch.id,
      fiscalYearId: fiscalYear.id,
      userId: user.id,
      isAdmin: true,
    };

    // Opening cash so the safe has a posted GL balance to pay from.
    const receipt = await cashTransactionService.create(
      companyId,
      branch.id,
      fiscalYear.id,
      {
        transactionKind: 'RECEIPT',
        date: VOUCHER_DATE,
        voucherNumber: voucherNumber(),
        description: 'H03 opening cash',
        amount: OPENING_CASH,
        currencyCode: 'EGP',
        safeId,
        lines: [{ accountId: revenueAccountId, amount: OPENING_CASH, entrySide: 'CREDIT' }],
      } as any,
      user.id
    );
    await treasuryPostingService.postCashTransaction(ctx, receipt.id);

    const app = express();
    app.use(express.json());
    app.use('/', cashTransactionRoutes);
    app.use(errorHandler);
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  beforeEach(async () => {
    await setPreventOverdraft(false);
  });

  it('normal posted edit: voucher, journal, fund and party balances move together', async () => {
    const id = await createPayment(PAYMENT);
    await treasuryPostingService.postCashTransaction(ctx, id);
    const before = await snapshot(id);

    const res = await patchVoucher(id, {
      ...paymentBody(400),
      expectedVersion: before.voucherVersion,
    });

    expect(res.status).toBe(200);
    const after = await snapshot(id);
    expect(after).toEqual({
      ...before,
      voucherAmount: 400,
      voucherVersion: before.voucherVersion + 2,
      voucherLineAmounts: [400],
      journalEntryId: before.journalEntryId,
      journalEntries: before.journalEntries,
      safeBalance: before.safeBalance - 100,
      safeLedgerNet: before.safeLedgerNet - 100,
      safePeriodNet: before.safePeriodNet - 100,
      supplierBalance: before.supplierBalance - 100,
      supplierRunningNet: before.supplierRunningNet + 100,
    });
    expect(after.journalEntryId).toBe(before.journalEntryId);
  });

  it('rewrite failure (overdraft) leaves voucher, journal and balances exactly as before', async () => {
    const id = await createPayment(PAYMENT);
    await treasuryPostingService.postCashTransaction(ctx, id);
    await setPreventOverdraft(true);
    const before = await snapshot(id);

    const res = await patchVoucher(id, {
      ...paymentBody(1500),
      expectedVersion: before.voucherVersion,
    });

    expect(res.status).toBe(422);
    expect(String(res.body.message)).toContain('غير كافٍ');
    expect(await snapshot(id)).toEqual(before);
  });

  it('unposted edit is unchanged: voucher updates, nothing is posted', async () => {
    const id = await createPayment(PAYMENT);
    const before = await snapshot(id);

    const res = await patchVoucher(id, {
      ...paymentBody(250),
      expectedVersion: before.voucherVersion,
    });

    expect(res.status).toBe(200);
    expect(await snapshot(id)).toEqual({
      ...before,
      voucherAmount: 250,
      voucherVersion: before.voucherVersion + 1,
      voucherLineAmounts: [250],
    });
  });

  it('post → unpost lifecycle is unchanged', async () => {
    const id = await createPayment(PAYMENT);
    const draft = await snapshot(id);

    await treasuryPostingService.postCashTransaction(ctx, id);
    const posted = await snapshot(id);
    expect(posted).toEqual({
      ...draft,
      isPosted: true,
      voucherVersion: draft.voucherVersion + 1,
      journalEntryId: expect.any(String),
      journalEntries: draft.journalEntries + 1,
      safeBalance: draft.safeBalance - PAYMENT,
      safeLedgerNet: draft.safeLedgerNet - PAYMENT,
      safePeriodNet: draft.safePeriodNet - PAYMENT,
      supplierBalance: draft.supplierBalance - PAYMENT,
      supplierRunningNet: draft.supplierRunningNet + PAYMENT,
    });

    await treasuryPostingService.unpostCashTransaction(ctx, id);
    const unposted = await snapshot(id);
    expect(unposted).toMatchObject({
      isPosted: false,
      safeBalance: draft.safeBalance,
      safeLedgerNet: draft.safeLedgerNet,
      safePeriodNet: draft.safePeriodNet,
      supplierBalance: draft.supplierBalance,
      supplierRunningNet: draft.supplierRunningNet,
    });
  });
});
