/**
 * Wave 1 — M2 treasury integration test.
 * Run: npm run test:wave1-treasury
 */
import { PrismaClient } from '@prisma/client';
import { cashTransactionService } from '../src/modules/treasury/services/cash-transaction.service.js';
import { treasuryPostingService } from '../src/modules/treasury/services/treasury-posting.service.js';
import { chequeLifecycleService } from '../src/modules/treasury/services/cheque-lifecycle.service.js';
import { treasuryPostingContextFromIds } from '../src/modules/treasury/services/treasury-posting-context.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const SAFE_ID = '00000000-0000-0000-0000-000000000070';
const BANK_ID = '00000000-0000-0000-0000-000000000071';
const BANK_ACCOUNT_ID = '00000000-0000-0000-0000-000000000072';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertClose(a: number, b: number, msg: string, eps = 0.02) {
  if (Math.abs(a - b) > eps) throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
}

async function assertJournalPostedBalanced(journalEntryId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { lines: true },
  });
  assert(!!entry, 'Journal entry exists');
  assert(entry!.isPosted === true, 'Journal posted');
  const totals = journalPostingService.computeBaseTotals(
    entry!.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
      exchangeRate: Number(l.exchangeRate),
    }))
  );
  assertClose(totals.debitBase, totals.creditBase, 'Journal balanced');
}

async function ensureAccount(code: string, arabicName: string, type: string) {
  const existing = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code },
  });
  if (existing) return existing.id;
  const created = await prisma.account.create({
    data: {
      companyId: COMPANY_ID,
      code,
      arabicName,
      accountType: type,
      isActive: true,
    },
  });
  return created.id;
}

async function seedM2Fixtures() {
  const glSettings: Record<string, string> = {
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
  };
  for (const [name, value] of Object.entries(glSettings)) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  const cashGl = await ensureAccount('1100', 'Cash Box', 'asset');
  const bankGl = await ensureAccount('1110', 'Bank', 'asset');
  const arGl = await ensureAccount('1200', 'AR', 'asset');
  const chequesHand = await ensureAccount('1400', 'Cheques Under Hand', 'asset');
  const chequesCollection = await ensureAccount('1410', 'Cheques Under Collection', 'asset');
  const notesPayable = await ensureAccount('2400', 'Notes Payable', 'liability');
  const customerAdvance = await ensureAccount('2500', 'Customer Advances', 'liability');

  // Merge into whatever accountDefinitions other shared-fixture scripts already set
  // instead of clobbering them (this company row is reused across all wave*.ts scripts).
  const existingTreasurySettings = await prisma.companySettings.findUnique({ where: { companyId: COMPANY_ID } });
  const existingTreasuryDefs = (existingTreasurySettings?.accountDefinitions as Record<string, string>) ?? {};
  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {
      accountDefinitions: {
        ...existingTreasuryDefs,
        cashAccount: '1100',
        bankAccount: '1110',
        arAccount: '1200',
        chequesUnderHandAccount: '1400',
        chequesUnderCollectionAccount: '1410',
        notesPayableAccount: '2400',
        customerAdvanceAccount: '2500',
      },
    },
    create: {
      companyId: COMPANY_ID,
      accountDefinitions: {
        cashAccount: '1100',
        bankAccount: '1110',
        arAccount: '1200',
        chequesUnderHandAccount: '1400',
        chequesUnderCollectionAccount: '1410',
        notesPayableAccount: '2400',
        customerAdvanceAccount: '2500',
      },
    },
  });

  await prisma.customer.upsert({
    where: { id: CUSTOMER_ID },
    update: { mainAccountId: arGl, balance: 0 },
    create: {
      id: CUSTOMER_ID,
      companyId: COMPANY_ID,
      arabicName: 'Test Customer',
      mainAccountId: arGl,
      balance: 0,
    },
  });

  await prisma.bank.upsert({
    where: { id: BANK_ID },
    update: {},
    create: {
      id: BANK_ID,
      companyId: COMPANY_ID,
      code: 'BNK1',
      arabicName: 'Test Bank',
    },
  });

  await prisma.bankAccount.upsert({
    where: { id: BANK_ACCOUNT_ID },
    update: { glAccountId: bankGl, balance: 0 },
    create: {
      id: BANK_ACCOUNT_ID,
      companyId: COMPANY_ID,
      bankId: BANK_ID,
      code: 'BA1',
      arabicName: 'Operating Account',
      currencyCode: 'EGP',
      glAccountId: bankGl,
      balance: 0,
    },
  });

  await prisma.safe.upsert({
    where: { id: SAFE_ID },
    update: { glAccountId: cashGl, balance: 0 },
    create: {
      id: SAFE_ID,
      companyId: COMPANY_ID,
      code: 'SAFE1',
      arabicName: 'Main Safe',
      currencyCode: 'EGP',
      glAccountId: cashGl,
      balance: 0,
    },
  });

  await resetFixtureDocuments();
}

/**
 * Idempotency: the voucher/cheque numbers below are fixed, so leftovers from an earlier
 * run would trip unique constraints and skew the balance assertions.
 */
async function resetFixtureDocuments() {
  await prisma.cashTransaction.deleteMany({
    where: { companyId: COMPANY_ID, voucherNumber: 'CR-W1-001' },
  });
  await prisma.treasuryReceipt.deleteMany({
    where: { companyId: COMPANY_ID, voucherNumber: 'CR-W1-001' },
  });
  await prisma.treasuryPayment.deleteMany({
    where: { companyId: COMPANY_ID, voucherNumber: 'CR-W1-001' },
  });
  await prisma.cheque.deleteMany({
    where: { companyId: COMPANY_ID, chequeNumber: 'CHQ-W1-001' },
  });

  // Phase 1 (H2/C11): journal entries now carry a unique activeSourceKey, and
  // unpost reverses via a dated contra entry instead of deleting/flag-flipping
  // the original — so leftover JEs (original + any reversal/re-post chain)
  // from a previous run must be cleared by source triple as well, or a
  // re-run collides on the unique constraint.
  const staleJes = await prisma.journalEntry.findMany({
    where: {
      companyId: COMPANY_ID,
      OR: [
        { sourceNumber: 'CR-W1-001' },
        { sourceNumber: 'CHQ-W1-001' },
      ],
    },
    select: { id: true },
  });
  const staleJeIds = staleJes.map((j) => j.id);
  if (staleJeIds.length > 0) {
    await prisma.journalEntry.updateMany({
      where: { reversalOfJournalEntryId: { in: staleJeIds } },
      data: { reversalOfJournalEntryId: null },
    });
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: staleJeIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: staleJeIds } } });
  }

  await prisma.customer.update({ where: { id: CUSTOMER_ID }, data: { balance: 0 } });
  await prisma.safe.update({ where: { id: SAFE_ID }, data: { balance: 0 } });
  await prisma.bankAccount.update({ where: { id: BANK_ACCOUNT_ID }, data: { balance: 0 } });
}

async function main() {
  console.log('Wave1 treasury integration test — start');
  await seedM2Fixtures();

  const ctx = treasuryPostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave1-treasury-test',
  });

  const receipt = await cashTransactionService.create(
    COMPANY_ID,
    BRANCH_ID,
    FISCAL_YEAR_ID,
    {
      transactionKind: 'RECEIPT',
      voucherNumber: 'CR-W1-001',
      date: new Date(),
      amount: 500,
      currencyCode: 'EGP',
      customerId: CUSTOMER_ID,
      safeId: SAFE_ID,
      description: 'Customer cash receipt',
    }
  );

  const postedReceipt = await treasuryPostingService.postCashTransaction(ctx, receipt.id);
  assert(postedReceipt?.isPosted === true, 'Receipt posted');
  await assertJournalPostedBalanced(postedReceipt!.journalEntryId!);

  const customerAfterReceipt = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  const safeAfterReceipt = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
  assertClose(Number(customerAfterReceipt!.balance), -500, 'Customer reduced by receipt');
  assertClose(Number(safeAfterReceipt!.balance), 500, 'Safe increased by receipt');

  // M23: this receipt has no invoiceId (unapplied), so the credit must land on the
  // dedicated customer-advance account, not the customer's AR control account.
  const receiptEntry = await prisma.journalEntry.findUnique({
    where: { id: postedReceipt!.journalEntryId! },
    include: { lines: true },
  });
  const arAccount = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '1200' },
    select: { id: true },
  });
  const advanceAccount = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '2500' },
    select: { id: true },
  });
  const creditLine = receiptEntry!.lines.find((l) => Number(l.credit) > 0);
  assert(
    creditLine?.accountId === advanceAccount!.id,
    'Unapplied receipt credits customer-advance account (M23)'
  );
  assert(
    creditLine?.accountId !== arAccount!.id,
    'Unapplied receipt does not post straight to AR (M23)'
  );

  const cheque = await chequeLifecycleService.createInwardCheque(ctx, {
    chequeNumber: 'CHQ-W1-001',
    bankName: 'Test Bank',
    amount: 300,
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
  });
  assert(cheque.status === 'IN_PORTFOLIO', 'Cheque in portfolio');
  await assertJournalPostedBalanced(cheque.portfolioJournalEntryId!);

  const customerAfterCheque = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  assertClose(Number(customerAfterCheque!.balance), -800, 'Customer after cheque receive');

  const deposited = await chequeLifecycleService.sendInwardToBank(ctx, cheque.id);
  assert(deposited.status === 'SENT_TO_BANK', 'Cheque sent to bank');
  await assertJournalPostedBalanced(deposited.depositJournalEntryId!);

  const cleared = await chequeLifecycleService.clearInwardCheque(
    ctx,
    cheque.id,
    BANK_ACCOUNT_ID
  );
  assert(cleared.status === 'CLEARED', 'Cheque cleared');
  await assertJournalPostedBalanced(cleared.clearJournalEntryId!);

  const bankAfter = await prisma.bankAccount.findUnique({ where: { id: BANK_ACCOUNT_ID } });
  assertClose(Number(bankAfter!.balance), 300, 'Bank balance after clear');

  console.log('Wave1 treasury integration test — PASSED');
}

main()
  .catch((e) => {
    console.error('Wave1 treasury integration test — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
