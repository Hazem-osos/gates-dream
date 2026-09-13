/**
 * Phase 0 — read-only GL reconciliation diagnostics.
 *
 * Runs against real tenant data. Never writes. Prints, per company:
 *   1. Trial balance: sum(debitBase) vs sum(creditBase) across all posted,
 *      non-cancelled, non-deleted journal lines.
 *   2. AR: GL "ar" control account (code 1121, or company's configured
 *      arAccount) balance vs Σ open (posted, remainingAmount > 0) SALE /
 *      PURCHASE_RETURN invoice remainingAmount vs Σ Customer.balance.
 *   3. AP: same for PURCHASE / SALE_RETURN vs Σ Supplier.balance.
 *   4. Cash/Bank: GL cash+bank control account balances vs Σ Safe.balance +
 *      Σ BankAccount.balance.
 *   5. Inventory: GL inventory control account balance vs Σ ItemQuantity.quantity
 *      × latest ItemCostHistory.cost per item (moving-average cost proxy).
 *
 * This script does not fix anything — it only measures drift so later phases
 * can be validated against a "before" baseline (Phase 0 requirement).
 *
 * Run: npm run recon:gl
 */
import { PrismaClient } from '@prisma/client';
import { SYSTEM_GL_CODES } from '../../src/modules/accounting/data/system-account-map.js';

const prisma = new PrismaClient();

const EPS = 0.01;

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function line(label: string, value: string) {
  console.log(`    ${label.padEnd(38)} ${value}`);
}

async function accountBalance(companyId: string, accountId: string): Promise<number> {
  const agg = await prisma.journalEntryLine.aggregate({
    where: {
      accountId,
      journalEntry: { companyId, isPosted: true, isCancelled: false, deletedAt: null },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  return Number(agg._sum.debitBase ?? 0) - Number(agg._sum.creditBase ?? 0);
}

async function accountIdsByCode(companyId: string, codes: string[]): Promise<string[]> {
  const rows = await prisma.account.findMany({
    where: { companyId, code: { in: codes }, deletedAt: null },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function accountDefIds(companyId: string, keys: string[]): Promise<string[]> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { accountDefinitions: true },
  });
  const defs = (settings?.accountDefinitions ?? {}) as Record<string, string | undefined>;
  const codesOrIds = keys.map((k) => defs[k]).filter((v): v is string => !!v);
  if (codesOrIds.length === 0) return [];
  const rows = await prisma.account.findMany({
    where: {
      companyId,
      deletedAt: null,
      OR: [{ id: { in: codesOrIds } }, { code: { in: codesOrIds } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function sumAccountBalances(companyId: string, accountIds: string[]): Promise<number> {
  let total = 0;
  for (const id of new Set(accountIds)) {
    total += await accountBalance(companyId, id);
  }
  return total;
}

async function reconcileCompany(companyId: string, companyName: string) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`Company: ${companyName} (${companyId})`);
  console.log('─'.repeat(72));

  // 1. Trial balance
  const tb = await prisma.journalEntryLine.aggregate({
    where: { journalEntry: { companyId, isPosted: true, isCancelled: false, deletedAt: null } },
    _sum: { debitBase: true, creditBase: true },
  });
  const debit = Number(tb._sum.debitBase ?? 0);
  const credit = Number(tb._sum.creditBase ?? 0);
  const tbDiff = debit - credit;
  console.log('\n  [1] Trial balance (all posted lines, base currency)');
  line('Total debitBase', fmt(debit));
  line('Total creditBase', fmt(credit));
  line('Diff (debit - credit)', `${fmt(tbDiff)} ${Math.abs(tbDiff) > EPS ? '❌ OUT OF BALANCE' : '✓'}`);

  // 2. AR reconciliation — postings actually land on each customer's own
  // mainAccountId/accountId (invoice-account-resolver.service.ts prefers that
  // over the company-wide default), so the "GL AR balance" must be the sum
  // across every customer sub-account, not just the single control-account code.
  const customerAccountRows = await prisma.customer.findMany({
    where: { companyId, deletedAt: null },
    select: { mainAccountId: true, accountId: true },
  });
  const arAccountIds = new Set([
    ...(await accountIdsByCode(companyId, [SYSTEM_GL_CODES.ar])),
    ...(await accountDefIds(companyId, ['arAccount', 'customerAccount', 'salesDebtorAccount'])),
    ...customerAccountRows.map((c) => c.mainAccountId).filter((x): x is string => !!x),
    ...customerAccountRows.map((c) => c.accountId).filter((x): x is string => !!x),
  ]);
  const arGlBalance = await sumAccountBalances(companyId, [...arAccountIds]);
  const openArInvoices = await prisma.invoice.aggregate({
    where: {
      companyId,
      isPosted: true,
      isCancelled: false,
      invoiceKind: { in: ['SALE', 'PURCHASE_RETURN'] },
    },
    _sum: { remainingAmount: true },
  });
  const customerBalances = await prisma.customer.aggregate({
    where: { companyId, deletedAt: null },
    _sum: { balance: true },
  });
  console.log('\n  [2] Accounts Receivable');
  line('GL AR control account balance', arAccountIds.size ? fmt(arGlBalance) : 'n/a (no AR account resolved)');
  line('Σ open SALE/PR invoice.remainingAmount', fmt(Number(openArInvoices._sum.remainingAmount ?? 0)));
  line('Σ Customer.balance', fmt(Number(customerBalances._sum.balance ?? 0)));
  if (arAccountIds.size) {
    const d1 = arGlBalance - Number(openArInvoices._sum.remainingAmount ?? 0);
    const d2 = arGlBalance - Number(customerBalances._sum.balance ?? 0);
    line('GL vs open invoices diff', `${fmt(d1)} ${Math.abs(d1) > EPS ? '❌' : '✓'}`);
    line('GL vs Customer.balance diff', `${fmt(d2)} ${Math.abs(d2) > EPS ? '❌' : '✓'}`);
  }

  // 3. AP reconciliation — same rationale as AR above, per supplier sub-account.
  const supplierAccountRows = await prisma.supplier.findMany({
    where: { companyId },
    select: { mainAccountId: true, accountId: true },
  });
  const apAccountIds = new Set([
    ...(await accountIdsByCode(companyId, [SYSTEM_GL_CODES.ap])),
    ...(await accountDefIds(companyId, ['apAccount', 'supplierAccount', 'purchaseCreditorAccount'])),
    ...supplierAccountRows.map((s) => s.mainAccountId).filter((x): x is string => !!x),
    ...supplierAccountRows.map((s) => s.accountId).filter((x): x is string => !!x),
  ]);
  const apGlBalance = await sumAccountBalances(companyId, [...apAccountIds]);
  const openApInvoices = await prisma.invoice.aggregate({
    where: {
      companyId,
      isPosted: true,
      isCancelled: false,
      invoiceKind: { in: ['PURCHASE', 'SALE_RETURN'] },
    },
    _sum: { remainingAmount: true },
  });
  const supplierBalances = await prisma.supplier.aggregate({
    where: { companyId },
    _sum: { balance: true },
  });
  console.log('\n  [3] Accounts Payable');
  line('GL AP control account balance', apAccountIds.size ? fmt(-apGlBalance) : 'n/a (no AP account resolved)');
  line('Σ open PURCHASE/SR invoice.remainingAmount', fmt(Number(openApInvoices._sum.remainingAmount ?? 0)));
  line('Σ Supplier.balance', fmt(Number(supplierBalances._sum.balance ?? 0)));
  if (apAccountIds.size) {
    const d1 = -apGlBalance - Number(openApInvoices._sum.remainingAmount ?? 0);
    const d2 = -apGlBalance - Number(supplierBalances._sum.balance ?? 0);
    line('GL vs open invoices diff', `${fmt(d1)} ${Math.abs(d1) > EPS ? '❌' : '✓'}`);
    line('GL vs Supplier.balance diff', `${fmt(d2)} ${Math.abs(d2) > EPS ? '❌' : '✓'}`);
  }

  // 4. Cash / bank reconciliation
  const cashAccountIds = new Set([
    ...(await accountIdsByCode(companyId, [SYSTEM_GL_CODES.cashMain, SYSTEM_GL_CODES.bankDefault])),
    ...(await accountDefIds(companyId, ['cashAccount', 'defaultCashAccount', 'cashBoxAccount', 'bankAccount', 'defaultBankAccount', 'bankGlAccount'])),
  ]);
  const cashGlBalance = await sumAccountBalances(companyId, [...cashAccountIds]);
  const safeBalances = await prisma.safe.aggregate({ where: { companyId }, _sum: { balance: true } });
  const bankBalances = await prisma.bankAccount.aggregate({ where: { companyId }, _sum: { balance: true } });
  const subledgerCash = Number(safeBalances._sum.balance ?? 0) + Number(bankBalances._sum.balance ?? 0);
  console.log('\n  [4] Cash & bank');
  line('GL cash+bank control account balance', cashAccountIds.size ? fmt(cashGlBalance) : 'n/a');
  line('Σ Safe.balance + Σ BankAccount.balance', fmt(subledgerCash));
  if (cashAccountIds.size) {
    const d = cashGlBalance - subledgerCash;
    line('GL vs subledger diff', `${fmt(d)} ${Math.abs(d) > EPS ? '❌' : '✓'}`);
  }

  // 5. Inventory reconciliation
  const invAccountIds = new Set([
    ...(await accountIdsByCode(companyId, [SYSTEM_GL_CODES.inventory])),
    ...(await accountDefIds(companyId, ['inventoryAccount', 'stockAccount', 'storeAccount'])),
  ]);
  const invGlBalance = await sumAccountBalances(companyId, [...invAccountIds]);

  const itemQuantities = await prisma.itemQuantity.findMany({
    where: { item: { companyId } },
    select: { itemId: true, quantity: true },
  });
  const qtyByItem = new Map<string, number>();
  for (const iq of itemQuantities) {
    qtyByItem.set(iq.itemId, (qtyByItem.get(iq.itemId) ?? 0) + Number(iq.quantity));
  }
  const itemIds = [...qtyByItem.keys()];
  let stockValue = 0;
  const BATCH = 200;
  for (let i = 0; i < itemIds.length; i += BATCH) {
    const batch = itemIds.slice(i, i + BATCH);
    const latestCosts = await prisma.itemCostHistory.findMany({
      where: { companyId, itemId: { in: batch } },
      orderBy: { serial: 'desc' },
      distinct: ['itemId'],
      select: { itemId: true, cost: true },
    });
    const costByItem = new Map(latestCosts.map((c) => [c.itemId, Number(c.cost)]));
    for (const id of batch) {
      const qty = qtyByItem.get(id) ?? 0;
      const cost = costByItem.get(id) ?? 0;
      stockValue += qty * cost;
    }
  }
  console.log('\n  [5] Inventory');
  line('GL inventory control account balance', invAccountIds.size ? fmt(invGlBalance) : 'n/a');
  line('Σ qty × latest avg cost (stock ledger)', fmt(stockValue));
  if (invAccountIds.size) {
    const d = invGlBalance - stockValue;
    line('GL vs stock ledger diff', `${fmt(d)} ${Math.abs(d) > EPS ? '❌' : '✓'}`);
  }
}

async function main() {
  console.log('Phase 0 — GL reconciliation diagnostics (READ-ONLY)');
  console.log('Run at:', new Date().toISOString());
  console.log(
    '\nNOTE: companies 00000000-0000-0000-0000-000000000001 and 00000000-0000-0000-0000-0000000000f0 are ' +
      'shared fixture companies reused by the test:wave*/test:gl-invariants scripts; their numbers reflect ' +
      'partial, repeated test runs rather than real tenant activity.'
  );

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, arabicName: true, englishName: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const c of companies) {
    await reconcileCompany(c.id, c.englishName || c.arabicName);
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`Reconciled ${companies.length} active companies. No data was modified.`);
}

main()
  .catch((e) => {
    console.error('Reconciliation diagnostics crashed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
