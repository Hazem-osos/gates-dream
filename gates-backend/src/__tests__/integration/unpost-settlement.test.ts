/**
 * Multi-tender unpost: 3,000 SI (1,000 cash + 2,000 cheque) must reverse atomically.
 * Requires Wave1 fixture company. Skips when the DB is not seeded.
 */
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { invoiceM5Service } from '../../modules/invoices/services/invoice-m5.service';
import { invoicePostingOrchestrator } from '../../modules/invoices/services/invoice-posting-orchestrator';
import { invoicePostingContextFromIds } from '../../modules/invoices/services/invoice-posting-context';
import { AppError } from '../../shared/middleware/error-handler';
import {
  INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE,
  INVOICE_UNPOST_BLOCKED_CHEQUE_MESSAGE,
} from '../../modules/invoices/services/invoice-settlement-policy';

loadEnv({ override: true });

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const ITEM_ID = '00000000-0000-0000-0000-000000000040';
const UNIT_ID = '00000000-0000-0000-0000-000000000041';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const SAFE_ID = '00000000-0000-0000-0000-000000000070';

const CASH_AMOUNT = 1000;
const CHEQUE_AMOUNT = 2000;
const INVOICE_TOTAL = CASH_AMOUNT + CHEQUE_AMOUNT;

function closeTo(a: number, b: number, eps = 0.02) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);
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

describe('unpost-settlement', () => {
  jest.setTimeout(60_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reverses cash + cheque tenders and restores party/safe balances', async () => {
    const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
    if (!company) {
      console.warn('Skip: Wave1 fixture company not seeded.');
      return;
    }

    const cashGl = await ensureAccount('1100', 'Cash', 'asset');
    await ensureAccount('1200', 'AR', 'asset');
    await ensureAccount('1300', 'Inventory', 'asset');
    await ensureAccount('1400', 'Cheques Under Hand', 'asset');
    await ensureAccount('1410', 'Cheques Under Collection', 'asset');
    await ensureAccount('2100', 'AP', 'liability');
    await ensureAccount('2400', 'Notes Payable', 'liability');
    await ensureAccount('4100', 'Sales', 'revenue');
    await ensureAccount('5100', 'COGS', 'expense');

    const settings = await prisma.companySettings.findUnique({
      where: { companyId: COMPANY_ID },
    });
    await prisma.companySettings.update({
      where: { companyId: COMPANY_ID },
      data: {
        accountDefinitions: {
          ...((settings?.accountDefinitions as Record<string, string>) ?? {}),
          cashAccount: '1100',
          arAccount: '1200',
          inventoryAccount: '1300',
          salesRevenueAccount: '4100',
          cogsAccount: '5100',
          chequesUnderHandAccount: '1400',
          chequesUnderCollectionAccount: '1410',
          notesPayableAccount: '2400',
        },
        allowNegativeBalance: true,
      },
    });

    await prisma.safe.upsert({
      where: { id: SAFE_ID },
      update: { glAccountId: cashGl.id, isActive: true },
      create: {
        id: SAFE_ID,
        companyId: COMPANY_ID,
        code: 'SAFE-UNPOST',
        arabicName: 'Unpost Safe',
        currencyCode: 'EGP',
        glAccountId: cashGl.id,
        balance: 0,
      },
    });

    await prisma.customer.update({
      where: { id: CUSTOMER_ID },
      data: { creditLimit: 1_000_000 },
    });

    const fy = await prisma.fiscalYear.findFirst({
      where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
    });
    expect(fy).toBeTruthy();

    const ctx = invoicePostingContextFromIds({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      fiscalYearId: fy!.id,
      userId: 'unpost-settlement-test',
    });

    const customerInitialRow = await prisma.customer.findUnique({
      where: { id: CUSTOMER_ID },
    });
    const safeInitialRow = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
    const customerInitial = Number(customerInitialRow!.balance);
    const safeInitial = Number(safeInitialRow!.balance);

    const suffix = Date.now().toString(36);
    const invoice = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fy!.id, {
      invoiceKind: 'SALE',
      invoiceNumber: `SI-UJ-${suffix}`,
      date: new Date(),
      currencyCode: 'EGP',
      customerId: CUSTOMER_ID,
      warehouseId: WAREHOUSE_ID,
      sourceYearId: fy!.legacyYearId,
      exchangeRate: 1,
      withholdingTaxAmount: 0,
      paymentMethod: 'SPLIT',
      paymentSplits: [
        { type: 'CASH', safeId: SAFE_ID, amount: CASH_AMOUNT },
        {
          type: 'CHEQUE',
          chequeNumber: `J${suffix}`,
          bankName: 'CIB',
          dueDate: new Date(),
          amount: CHEQUE_AMOUNT,
        },
      ],
      lines: [
        {
          itemId: ITEM_ID,
          unitId: UNIT_ID,
          quantity: 1,
          baseQuantity: 1,
          price: INVOICE_TOTAL,
          lineOrder: 1,
        },
      ],
    });
    expect(invoice).toBeTruthy();

    await invoicePostingOrchestrator.post(ctx, invoice!.id);

    const posted = await prisma.invoice.findUnique({ where: { id: invoice!.id } });
    expect(posted!.isPosted).toBe(true);
    // H5: an IN_PORTFOLIO cheque is not yet collected, so it must not count toward
    // paidAmount — only the cleared cash tender does. The cheque sits separately as
    // "cheques under collection", not as settled AR.
    closeTo(Number(posted!.paidAmount), CASH_AMOUNT);
    closeTo(Number(posted!.remainingAmount), CHEQUE_AMOUNT);
    expect(posted!.paymentStatus).toBe('PARTIALLY_PAID');

    const customerPosted = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
    const safePosted = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
    // Invoice AR +3,000, cash collection −1,000, inward cheque −2,000 ⇒ net 0 vs initial.
    // The 2,000 cheque remains in portfolio (notes receivable), not leftover customer AR.
    closeTo(Number(customerPosted!.balance), customerInitial);
    closeTo(Number(safePosted!.balance), safeInitial + CASH_AMOUNT);

    const cashPosted = await prisma.cashTransaction.findMany({
      where: { invoiceId: invoice!.id, isCancelled: false, isPosted: true },
    });
    expect(cashPosted.length).toBeGreaterThanOrEqual(1);

    const chequePosted = await prisma.cheque.findFirst({
      where: { invoiceId: invoice!.id },
    });
    expect(chequePosted?.status).toBe('UNDER_HAND');
    closeTo(Number(chequePosted!.amount), CHEQUE_AMOUNT);

    const allocPosted = await prisma.paymentAllocation.count({
      where: { invoiceId: invoice!.id },
    });
    expect(allocPosted).toBeGreaterThanOrEqual(1);

    await invoicePostingOrchestrator.unpost(ctx, invoice!.id);

    const allocAfter = await prisma.paymentAllocation.count({
      where: { invoiceId: invoice!.id },
    });
    expect(allocAfter).toBe(0);

    const liveCash = await prisma.cashTransaction.count({
      where: { invoiceId: invoice!.id, isCancelled: false, isPosted: true },
    });
    expect(liveCash).toBe(0);

    const reversedCash = await prisma.cashTransaction.findMany({
      where: { invoiceId: invoice!.id },
    });
    expect(reversedCash.length).toBeGreaterThanOrEqual(1);
    expect(reversedCash.every((row) => row.isPosted === false || row.isCancelled === true)).toBe(
      true
    );

    const chequeAfter = await prisma.cheque.findUnique({
      where: { id: chequePosted!.id },
    });
    expect(chequeAfter?.status).toBe('CANCELLED');
    expect(chequeAfter?.invoiceId).toBeNull();

    const customerAfter = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
    const safeAfter = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
    closeTo(Number(customerAfter!.balance), customerInitial);
    closeTo(Number(safeAfter!.balance), safeInitial);

    await expect(invoiceM5Service.remove(COMPANY_ID, invoice!.id)).rejects.toMatchObject({
      statusCode: 422,
      message: INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE,
    });
  });

  it('blocks unpost when a linked cheque has been sent to the bank', async () => {
    const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
    if (!company) return;

    const fy = await prisma.fiscalYear.findFirst({
      where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
    });
    if (!fy) return;

    const ctx = invoicePostingContextFromIds({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      fiscalYearId: fy.id,
      userId: 'unpost-settlement-test',
    });

    const suffix = Date.now().toString(36);
    const invoice = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fy.id, {
      invoiceKind: 'SALE',
      invoiceNumber: `SI-UB-${suffix}`,
      date: new Date(),
      currencyCode: 'EGP',
      customerId: CUSTOMER_ID,
      warehouseId: WAREHOUSE_ID,
      sourceYearId: fy.legacyYearId,
      exchangeRate: 1,
      withholdingTaxAmount: 0,
      paymentMethod: 'SPLIT',
      paymentSplits: [
        { type: 'CASH', safeId: SAFE_ID, amount: CASH_AMOUNT },
        {
          type: 'CHEQUE',
          chequeNumber: `B${suffix}`,
          bankName: 'CIB',
          dueDate: new Date(),
          amount: CHEQUE_AMOUNT,
        },
      ],
      lines: [
        {
          itemId: ITEM_ID,
          unitId: UNIT_ID,
          quantity: 1,
          baseQuantity: 1,
          price: INVOICE_TOTAL,
          lineOrder: 1,
        },
      ],
    });

    await invoicePostingOrchestrator.post(ctx, invoice!.id);
    await prisma.cheque.updateMany({
      where: { invoiceId: invoice!.id },
      data: { status: 'SENT_TO_BANK' },
    });

    try {
      await invoicePostingOrchestrator.unpost(ctx, invoice!.id);
      throw new Error('expected unpost to fail for banked cheque');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(422);
      expect((e as AppError).message).toBe(INVOICE_UNPOST_BLOCKED_CHEQUE_MESSAGE);
    }

    await prisma.cheque.updateMany({
      where: { invoiceId: invoice!.id },
      data: { status: 'UNDER_HAND' },
    });
    await invoicePostingOrchestrator.unpost(ctx, invoice!.id);
  });
});
