/**
 * Multi-tender invoice unpost: 1000 cash + 2000 cheque must reverse atomically.
 * Run: npx tsx scripts/test-invoice-unpost-settlements.ts
 */
import { PrismaClient } from '@prisma/client';
import { invoiceM5Service } from '../src/modules/invoices/services/invoice-m5.service.js';
import { invoicePostingOrchestrator } from '../src/modules/invoices/services/invoice-posting-orchestrator.js';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { AppError } from '../src/shared/middleware/error-handler.js';
import { INVOICE_UNPOST_BLOCKED_CHEQUE_MESSAGE } from '../src/modules/invoices/services/invoice-settlement-policy.js';
import { invoiceSettlementService } from '../src/modules/invoices/services/invoice-settlement.service.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const ITEM_ID = '00000000-0000-0000-0000-000000000040';
const UNIT_ID = '00000000-0000-0000-0000-000000000041';
const SUPPLIER_ID = '00000000-0000-0000-0000-000000000050';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const SAFE_ID = '00000000-0000-0000-0000-000000000070';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertClose(a: number, b: number, msg: string, eps = 0.02) {
  if (Math.abs(a - b) > eps) throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
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

async function main() {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) {
    console.log('Skip: Wave1 fixture company not seeded. Run test:wave1-invoices first.');
    process.exit(0);
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

  const settings = await prisma.companySettings.findUnique({ where: { companyId: COMPANY_ID } });
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
    data: { creditLimit: 1_000_000, balance: 0 },
  });

  const fy = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fy, 'Fiscal year');

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: fy!.id,
    userId: 'unpost-settlement-test',
  });

  const suffix = Date.now();
  const invoice = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fy!.id, {
    invoiceKind: 'SALE',
    invoiceNumber: `SI-UNPOST-SPLIT-${suffix}`,
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fy!.legacyYearId,
    paymentMethod: 'SPLIT',
    paymentSplits: [
      { type: 'CASH', safeId: SAFE_ID, amount: 1000 },
      {
        type: 'CHEQUE',
        chequeNumber: `CHQ-${suffix}`,
        bankName: 'CIB',
        dueDate: new Date(),
        amount: 2000,
      },
    ],
    lines: [
      {
        itemId: ITEM_ID,
        unitId: UNIT_ID,
        quantity: 1,
        baseQuantity: 1,
        price: 3000,
        lineOrder: 1,
      },
    ],
  });
  assert(!!invoice, 'Split invoice created');

  const customerBefore = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  const safeBefore = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
  const balanceBefore = Number(customerBefore!.balance);
  const safeBalanceBefore = Number(safeBefore!.balance);

  await invoicePostingOrchestrator.post(ctx, invoice!.id);

  const posted = await prisma.invoice.findUnique({ where: { id: invoice!.id } });
  assert(posted!.isPosted === true, 'Invoice posted');
  // H5 fix: the cheque leg (2000) sits IN_PORTFOLIO — not yet cleared by the
  // bank — so only the 1000 cash leg counts as real paidAmount. The cheque
  // amount is a distinct "under collection" position, not settled cash.
  assertClose(Number(posted!.paidAmount), 1000, 'Only cleared cash settles immediately (H5)');
  assertClose(Number(posted!.remainingAmount), 2000, 'Uncleared cheque still outstanding (H5)');
  assert(posted!.paymentStatus === 'PARTIALLY_PAID', 'Status PARTIALLY_PAID while cheque uncleared');

  const cashBeforeUnpost = await prisma.cashTransaction.findMany({
    where: { invoiceId: invoice!.id, isCancelled: false, isPosted: true },
  });
  assert(cashBeforeUnpost.length >= 1, 'Posted cash settlement exists');

  const chequeBefore = await prisma.cheque.findFirst({
    where: { invoiceId: invoice!.id },
  });
  assert(chequeBefore?.status === 'IN_PORTFOLIO', 'Cheque in portfolio');

  const { chequesUnderCollection } = await invoiceSettlementService.listCheques(
    COMPANY_ID,
    invoice!.id
  );
  assertClose(chequesUnderCollection, 2000, 'Cheque surfaced as under-collection position (H5)');

  const allocBefore = await prisma.paymentAllocation.count({
    where: { invoiceId: invoice!.id },
  });
  assert(allocBefore >= 1, 'Payment allocations exist');

  await invoicePostingOrchestrator.unpost(ctx, invoice!.id);

  const unposted = await prisma.invoice.findUnique({ where: { id: invoice!.id } });
  assert(unposted!.isPosted === false, 'Invoice unposted');
  assertClose(Number(unposted!.paidAmount), 0, 'Paid amount cleared');
  assertClose(Number(unposted!.remainingAmount), Number(unposted!.netAmount), 'Remaining restored');
  assert(unposted!.paymentStatus === 'UNPAID', 'Status UNPAID');

  const liveCash = await prisma.cashTransaction.count({
    where: { invoiceId: invoice!.id, isCancelled: false, isPosted: true },
  });
  assert(liveCash === 0, 'No live posted cash txs');

  const liveAlloc = await prisma.paymentAllocation.count({
    where: { invoiceId: invoice!.id },
  });
  assert(liveAlloc === 0, 'Allocations deleted');

  const chequeAfter = await prisma.cheque.findUnique({ where: { id: chequeBefore!.id } });
  assert(chequeAfter?.status === 'CANCELLED', 'Portfolio cheque cancelled');
  assert(chequeAfter?.invoiceId == null, 'Cancelled cheque unlinked from invoice');

  const customerAfter = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  const safeAfter = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
  assertClose(Number(customerAfter!.balance), balanceBefore, 'Customer balance restored');
  assertClose(Number(safeAfter!.balance), safeBalanceBefore, 'Safe balance restored');

  const blockedInvoice = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fy!.id, {
    invoiceKind: 'SALE',
    invoiceNumber: `SI-UNPOST-BANKED-${suffix}`,
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fy!.legacyYearId,
    paymentMethod: 'SPLIT',
    paymentSplits: [
      { type: 'CASH', safeId: SAFE_ID, amount: 1000 },
      {
        type: 'CHEQUE',
        chequeNumber: `CHQ-BANK-${suffix}`,
        bankName: 'CIB',
        dueDate: new Date(),
        amount: 2000,
      },
    ],
    lines: [
      {
        itemId: ITEM_ID,
        unitId: UNIT_ID,
        quantity: 1,
        baseQuantity: 1,
        price: 3000,
        lineOrder: 1,
      },
    ],
  });
  await invoicePostingOrchestrator.post(ctx, blockedInvoice!.id);
  await prisma.cheque.updateMany({
    where: { invoiceId: blockedInvoice!.id },
    data: { status: 'SENT_TO_BANK' },
  });

  let blocked = false;
  try {
    await invoicePostingOrchestrator.unpost(ctx, blockedInvoice!.id);
  } catch (e) {
    blocked =
      (e instanceof AppError || e instanceof Error) &&
      e.message.includes(INVOICE_UNPOST_BLOCKED_CHEQUE_MESSAGE.slice(0, 20));
  }
  assert(blocked, 'Unpost blocked for banked cheque');

  await prisma.cheque.updateMany({
    where: { invoiceId: blockedInvoice!.id },
    data: { status: 'IN_PORTFOLIO' },
  });
  await invoicePostingOrchestrator.unpost(ctx, blockedInvoice!.id);

  console.log('Invoice unpost settlement teardown — PASSED');
}

main()
  .catch((e) => {
    console.error('Invoice unpost settlement teardown — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
