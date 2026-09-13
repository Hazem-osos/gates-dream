/**
 * Wave 2 — M15 / M23 trade (LC landed cost + bank guarantee) integration test.
 * Run: npm run test:wave2-trade
 * Prerequisite: wave1 fixtures (npm run test:wave1-invoices) or this script seeds trade accounts.
 */
import { PrismaClient } from '@prisma/client';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { letterOfCreditService } from '../src/modules/trade/services/letter-of-credit.service.js';
import { letterOfGuaranteeService } from '../src/modules/trade/services/letter-of-guarantee.service.js';
import { itemCostService } from '../src/modules/inventory/services/item-cost.service.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const ITEM_ID = '00000000-0000-0000-0000-000000000040';
const UNIT_ID = '00000000-0000-0000-0000-000000000041';
const SUPPLIER_ID = '00000000-0000-0000-0000-000000000050';
const BANK_ID = '00000000-0000-0000-0000-000000000071';
const BANK_ACCOUNT_ID = '00000000-0000-0000-0000-000000000072';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertClose(a: number, b: number, msg: string, eps = 0.05) {
  if (Math.abs(a - b) > eps) {
    throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
  }
}

async function assertJournalPostedBalanced(journalEntryId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { lines: true },
  });
  assert(!!entry, 'Journal entry exists');
  assert(entry!.isPosted === true, 'Journal entry is posted');
  const totals = journalPostingService.computeBaseTotals(
    entry!.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
      exchangeRate: Number(l.exchangeRate),
    }))
  );
  assertClose(totals.debitBase, totals.creditBase, 'Journal balanced at 4dp');
}

async function seedTradeFixtures() {
  const extraAccounts = [
    { code: '1400', arabicName: 'Open LC WIP', type: 'asset' },
    { code: '1410', arabicName: 'LG Cash Cover', type: 'asset' },
    { code: '1110', arabicName: 'Bank Current', type: 'asset' },
    { code: '5200', arabicName: 'Bank Commission', type: 'expense' },
    { code: '5210', arabicName: 'LG Confiscation Loss', type: 'expense' },
  ];
  for (const a of extraAccounts) {
    const existing = await prisma.account.findFirst({
      where: { companyId: COMPANY_ID, code: a.code },
    });
    if (!existing) {
      await prisma.account.create({
        data: {
          companyId: COMPANY_ID,
          code: a.code,
          arabicName: a.arabicName,
          accountType: a.type,
          isActive: true,
        },
      });
    }
  }

  const bankGl = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '1110' },
  });
  assert(!!bankGl, 'Bank GL account');

  // Merge into whatever accountDefinitions other shared-fixture scripts already set
  // instead of clobbering them (this company row is reused across all wave*.ts scripts).
  const existingTradeSettings = await prisma.companySettings.findUnique({ where: { companyId: COMPANY_ID } });
  const existingTradeDefs = (existingTradeSettings?.accountDefinitions as Record<string, string>) ?? {};
  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {
      accountDefinitions: {
        ...existingTradeDefs,
        inventoryAccount: '1300',
        openLcWipAccount: '1400',
        lgCashCoverAccount: '1410',
        bankCommissionAccount: '5200',
        lgConfiscationLossAccount: '5210',
        bankAccount: '1110',
      },
    },
    create: {
      companyId: COMPANY_ID,
      accountDefinitions: {
        inventoryAccount: '1300',
        openLcWipAccount: '1400',
        lgCashCoverAccount: '1410',
        bankCommissionAccount: '5200',
        lgConfiscationLossAccount: '5210',
        bankAccount: '1110',
      },
    },
  });

  await prisma.tradeSettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {},
    create: {
      companyId: COMPANY_ID,
      openLcWipAccountCode: '1400',
      inventoryAccountCode: '1300',
      lcPayableAccountCode: '2100',
      lgCashCoverAccountCode: '1410',
      bankCommissionAccountCode: '5200',
    },
  });

  await prisma.bank.upsert({
    where: { id: BANK_ID },
    update: {},
    create: {
      id: BANK_ID,
      companyId: COMPANY_ID,
      arabicName: 'Trade Test Bank',
      code: 'TB01',
    },
  });

  await prisma.bankAccount.upsert({
    where: { id: BANK_ACCOUNT_ID },
    update: { glAccountId: bankGl!.id },
    create: {
      id: BANK_ACCOUNT_ID,
      companyId: COMPANY_ID,
      bankId: BANK_ID,
      code: 'TB-ACC',
      arabicName: 'Trade Bank Account',
      currencyCode: 'EGP',
      glAccountId: bankGl!.id,
      balance: 0,
    },
  });

  await prisma.itemQuantity.updateMany({
    where: { itemId: ITEM_ID, warehouseId: WAREHOUSE_ID },
    data: { quantity: 0 },
  });

  await prisma.inventoryMovement.deleteMany({
    where: { companyId: COMPANY_ID, itemId: ITEM_ID },
  });

  await prisma.itemCostHistory.deleteMany({
    where: { companyId: COMPANY_ID, itemId: ITEM_ID },
  });
}

async function warehouseQty(): Promise<number> {
  const row = await prisma.itemQuantity.findFirst({
    where: { itemId: ITEM_ID, warehouseId: WAREHOUSE_ID, locationId: null },
  });
  return row ? Number(row.quantity) : 0;
}

async function main() {
  console.log('Wave2 trade integration test — start');

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fiscalYear, 'Run test:wave1-invoices first (fiscal year fixture)');

  await seedTradeFixtures();

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave2-trade-test',
  });

  const lcNo = `LC-W2-${Date.now()}`;
  const merchandiseBase = 100_000;
  const lc = await letterOfCreditService.open(ctx, {
    lcNumber: lcNo,
    supplierId: SUPPLIER_ID,
    bankAccountId: BANK_ACCOUNT_ID,
    warehouseId: WAREHOUSE_ID,
    currencyCode: 'EGP',
    exchangeRate: 1,
    totalAmountFx: merchandiseBase,
    sourceYearId: fiscalYear!.legacyYearId,
  });
  assert(lc.status === 'OPEN', 'LC opened');
  assert(!!lc.openingJournalEntryId, 'Opening JE linked');
  await assertJournalPostedBalanced(lc.openingJournalEntryId!);

  await letterOfCreditService.addExpense(ctx, lc.id, {
    expenseType: 'CUSTOMS',
    amount: 10_000,
    description: 'Customs duties',
  });
  await letterOfCreditService.addExpense(ctx, lc.id, {
    expenseType: 'FREIGHT',
    amount: 5_000,
    description: 'Ocean freight',
  });

  const cleared = await letterOfCreditService.clear(ctx, lc.id, [
    {
      itemId: ITEM_ID,
      unitId: UNIT_ID,
      quantity: 100,
      merchandiseBase: 100_000,
    },
  ]);
  assert(cleared.status === 'CLOSED', 'LC closed after clearance');
  assert(!!cleared.clearingJournalEntryId, 'Clearing JE linked');
  await assertJournalPostedBalanced(cleared.clearingJournalEntryId!);
  assertClose(Number(cleared.totalLandedCost), 115_000, 'Total landed cost');

  assertClose(await warehouseQty(), 100, 'Warehouse qty after LC receipt');
  const landedLine = cleared.receiptLines[0];
  assertClose(Number(landedLine.landedUnitCostBase), 1150, 'Landed unit cost');

  const avgCost = await itemCostService.getCostAsOf(
    COMPANY_ID,
    ITEM_ID,
    new Date()
  );
  assertClose(avgCost, 1150, 'Moving average after LC clearance');

  const lgNo = `LG-W2-${Date.now()}`;
  const lg = await letterOfGuaranteeService.issue(ctx, {
    lgNumber: lgNo,
    lgType: 'BID_BOND',
    bankAccountId: BANK_ACCOUNT_ID,
    beneficiaryName: 'Ministry of Housing',
    amount: 500_000,
    cashCoverAmount: 50_000,
    commissionAmount: 2_500,
    issueDate: new Date(),
    sourceYearId: fiscalYear!.legacyYearId,
  });
  assert(lg.status === 'ACTIVE', 'LG issued');
  assert(!!lg.issueJournalEntryId, 'LG issue JE');
  await assertJournalPostedBalanced(lg.issueJournalEntryId!);

  const released = await letterOfGuaranteeService.release(ctx, lg.id);
  assert(released.status === 'RELEASED', 'LG released');
  assert(!!released.releaseJournalEntryId, 'LG release JE');
  await assertJournalPostedBalanced(released.releaseJournalEntryId!);

  const lgConfNo = `LG-CONF-${Date.now()}`;
  const lgConf = await letterOfGuaranteeService.issue(ctx, {
    lgNumber: lgConfNo,
    lgType: 'PERFORMANCE',
    bankAccountId: BANK_ACCOUNT_ID,
    beneficiaryName: 'Confiscation test',
    amount: 200_000,
    cashCoverAmount: 20_000,
    commissionAmount: 0,
    issueDate: new Date(),
    sourceYearId: fiscalYear!.legacyYearId,
  });
  const confiscated = await letterOfGuaranteeService.confiscate(ctx, lgConf.id);
  assert(confiscated.status === 'CONFISCATED', 'LG confiscated');
  assert(!!confiscated.confiscateJournalEntryId, 'LG confiscate JE');
  await assertJournalPostedBalanced(confiscated.confiscateJournalEntryId!);

  console.log('Wave2 trade integration test — PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
