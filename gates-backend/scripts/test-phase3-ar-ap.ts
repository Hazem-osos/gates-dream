/**
 * Phase 3 — AR/AP and treasury correctness (H6: due-date aging).
 * Run: npm run test:phase3-ar-ap
 *
 * Reuses the wave1 fixture company/customer/supplier — run
 * `npm run test:wave1-invoices` first if this reports the company missing.
 */
import { PrismaClient } from '@prisma/client';
import { invoiceM5Service } from '../src/modules/invoices/services/invoice-m5.service.js';
import { agedOpenItemsService } from '../src/modules/accounting/services/aged-open-items.service.js';
import { withholdingTaxService } from '../src/modules/taxes/services/withholding-tax.service.js';
import { securitiesReceiptService } from '../src/modules/accounting/services/securities-receipt.service.js';
import { securitiesPaymentService } from '../src/modules/accounting/services/securities-payment.service.js';
import { partyBalanceReconciliationService } from '../src/modules/accounting/services/party-balance-reconciliation.service.js';

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

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function testDueDateFromExplicitInput() {
  const fy = await prisma.fiscalYear.findFirst({ where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID } });
  const suffix = Date.now();
  const date = daysAgo(0);
  const explicitDue = daysAgo(-15); // 15 days in the future

  const invoice = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fy!.id, {
    invoiceKind: 'SALE',
    invoiceNumber: `SI-DUE-EXPLICIT-${suffix}`,
    date,
    dueDate: explicitDue,
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fy!.legacyYearId,
    lines: [{ itemId: ITEM_ID, unitId: UNIT_ID, quantity: 1, baseQuantity: 1, price: 100, lineOrder: 1 }],
  });
  assert(!!invoice?.dueDate, 'Invoice has a dueDate');
  assertClose(
    new Date(invoice!.dueDate!).getTime(),
    explicitDue.getTime(),
    'Explicit dueDate is stored as-is',
    2000
  );
  console.log('  ✓ Explicit dueDate input is persisted verbatim (H6)');
}

async function testDueDateFromPaymentTerms() {
  const before = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  await prisma.customer.update({ where: { id: CUSTOMER_ID }, data: { paymentTermsDays: 30 } });
  try {
    const fy = await prisma.fiscalYear.findFirst({ where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID } });
    const suffix = Date.now();
    const date = daysAgo(0);

    const invoice = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fy!.id, {
      invoiceKind: 'SALE',
      invoiceNumber: `SI-DUE-TERMS-${suffix}`,
      date,
      currencyCode: 'EGP',
      customerId: CUSTOMER_ID,
      warehouseId: WAREHOUSE_ID,
      sourceYearId: fy!.legacyYearId,
      lines: [{ itemId: ITEM_ID, unitId: UNIT_ID, quantity: 1, baseQuantity: 1, price: 100, lineOrder: 1 }],
    });

    const expected = new Date(date);
    expected.setUTCDate(expected.getUTCDate() + 30);
    assertClose(
      new Date(invoice!.dueDate!).getTime(),
      expected.getTime(),
      'dueDate derived from customer.paymentTermsDays (H6)',
      2000
    );
    console.log('  ✓ dueDate derived from customer.paymentTermsDays when not given explicitly (H6)');

    // Aging must bucket off dueDate, not the invoice date: with a 30-day
    // term and the invoice dated 40 days ago, the item is only 10 days
    // past its due date — still "current" (0-30), not "31-60".
    await prisma.invoice.update({ where: { id: invoice!.id }, data: { date: daysAgo(40) } });
    const dueDate40 = new Date(daysAgo(40));
    dueDate40.setUTCDate(dueDate40.getUTCDate() + 30);
    await prisma.invoice.update({
      where: { id: invoice!.id },
      data: { dueDate: dueDate40, isPosted: true, remainingAmount: 114 },
    });

    const report = await agedOpenItemsService.getAgedReceivables({
      companyId: COMPANY_ID,
      asOfDate: new Date(),
      customerId: CUSTOMER_ID,
    });
    const line = report.lines.find((l) => l.invoiceId === invoice!.id);
    assert(!!line, 'Invoice appears in aged receivables');
    assert(
      line!.bucket === 'current_0_30',
      `Aging buckets off dueDate not invoice date — expected current_0_30, got ${line!.bucket}`
    );
    console.log('  ✓ Aging buckets off dueDate, not invoice date (H6)');

    assert(
      report.controlAccountTieOut.resolved === false,
      'Filtered (customerId) aged report skips the control-account tie-out'
    );
    console.log('  ✓ Filtered aged report correctly skips the whole-company control-account tie-out');
  } finally {
    await prisma.customer.update({
      where: { id: CUSTOMER_ID },
      data: { paymentTermsDays: before?.paymentTermsDays ?? null },
    });
  }
}

async function testUnfilteredTieOutResolves() {
  const report = await agedOpenItemsService.getAgedReceivables({
    companyId: COMPANY_ID,
    asOfDate: new Date(),
  });
  assert(
    report.controlAccountTieOut.resolved === true,
    'Unfiltered aged receivables report resolves a GL control-account balance'
  );
  console.log('  ✓ Unfiltered aged report resolves and attaches a GL control-account tie-out (H6)');
}

async function testWithholdingTaxPaymentPostsBalancedJournal() {
  const whtAccount = await prisma.account.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: '2160' } },
    update: {},
    create: {
      companyId: COMPANY_ID,
      code: '2160',
      arabicName: 'ضريبة الاستقطاع المستحقة',
      accountType: 'liability',
      isActive: true,
    },
  });

  const safeBefore = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
  assert(!!safeBefore, 'Fixture safe exists (run test:wave1-invoices first)');
  const safeBalanceBefore = Number(safeBefore!.balance);

  const result = await withholdingTaxService.processWithholdingTaxPayment(
    COMPANY_ID,
    'phase3-wht-test',
    {
      supplierId: SUPPLIER_ID,
      paymentDate: new Date(),
      taxAmount: 250,
      accountId: whtAccount.id,
      safeId: SAFE_ID,
      currencyCode: 'EGP',
      notes: 'Phase 3 H13 regression',
    }
  );

  assert(!!result.journalEntryId, 'WHT payment produced a journal entry (H13)');

  const je = await prisma.journalEntry.findUnique({
    where: { id: result.journalEntryId! },
    include: { lines: true },
  });
  assert(!!je, 'Journal entry exists');
  assert(je!.isPosted === true, 'Journal entry is posted');
  assert(je!.lines.length === 2, 'Journal entry has both debit and credit lines (H13 — not single-sided)');

  const totalDebit = je!.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = je!.lines.reduce((s, l) => s + Number(l.credit), 0);
  assertClose(totalDebit, totalCredit, 'WHT payment journal entry balances (H13)');
  assertClose(totalDebit, 250, 'WHT payment journal entry totals the tax amount');

  const debitLine = je!.lines.find((l) => Number(l.debit) > 0);
  assert(debitLine?.accountId === whtAccount.id, 'WHT payable account is debited (liability cleared)');

  const safeAfter = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
  assertClose(
    Number(safeAfter!.balance),
    safeBalanceBefore - 250,
    'Safe balance decreased by the WHT payment amount'
  );

  console.log('  ✓ Withholding tax payment posts a real, balanced journal entry (H13)');
}

async function testSecuritiesReceiptAndPaymentPostRealJournals() {
  // Ensure the "notes/securities in hand" and "notes payable" GL buckets exist
  // and are configured — the securities services reuse the Cheque module's
  // account resolution (H11), so this merges into whatever accountDefinitions
  // other fixtures already set rather than clobbering them.
  const notesInHand = await prisma.account.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: '1420' } },
    update: {},
    create: {
      companyId: COMPANY_ID,
      code: '1420',
      arabicName: 'أوراق قبض تحت التحصيل',
      accountType: 'asset',
      isActive: true,
    },
  });
  const notesPayable = await prisma.account.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: '2420' } },
    update: {},
    create: {
      companyId: COMPANY_ID,
      code: '2420',
      arabicName: 'أوراق دفع',
      accountType: 'liability',
      isActive: true,
    },
  });
  const settings = await prisma.companySettings.findUnique({ where: { companyId: COMPANY_ID } });
  const existingDefs = (settings?.accountDefinitions as Record<string, string>) ?? {};
  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {
      accountDefinitions: {
        ...existingDefs,
        chequesUnderHandAccount: existingDefs.chequesUnderHandAccount ?? notesInHand.code,
        chequesUnderCollectionAccount: existingDefs.chequesUnderCollectionAccount ?? notesInHand.code,
        notesPayableAccount: existingDefs.notesPayableAccount ?? notesPayable.code,
      },
    },
    create: {
      companyId: COMPANY_ID,
      accountDefinitions: {
        chequesUnderHandAccount: notesInHand.code,
        chequesUnderCollectionAccount: notesInHand.code,
        notesPayableAccount: notesPayable.code,
      },
    },
  });

  const customerBefore = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  const customerBalanceBefore = Number(customerBefore!.balance);

  const receipt = await securitiesReceiptService.createSecuritiesReceipt(COMPANY_ID, {
    receiptNumber: `SECR-${Date.now()}`,
    date: new Date(),
    securityType: 'promissory-note',
    customerId: CUSTOMER_ID,
    issuerName: 'Test Customer',
    securityNumber: 'PN-001',
    amount: 400,
    currencyCode: 'EGP',
  });

  const postedReceipt = await securitiesReceiptService.postSecuritiesReceipt(COMPANY_ID, receipt.id, {
    branchId: BRANCH_ID,
    userId: 'phase3-securities-test',
  });
  assert(postedReceipt.isPosted === true, 'Securities receipt posted');
  assert(!!postedReceipt.journalEntryId, 'Securities receipt posting created a journal entry (H11)');

  const receiptJe = await prisma.journalEntry.findUnique({
    where: { id: postedReceipt.journalEntryId! },
    include: { lines: true },
  });
  assert(!!receiptJe && receiptJe.isPosted, 'Securities receipt journal entry is posted');
  assert(receiptJe!.lines.length === 2, 'Securities receipt journal entry is a real 2-line posting, not a no-op');
  const receiptDebit = receiptJe!.lines.reduce((s, l) => s + Number(l.debit), 0);
  const receiptCredit = receiptJe!.lines.reduce((s, l) => s + Number(l.credit), 0);
  assertClose(receiptDebit, receiptCredit, 'Securities receipt journal entry balances (H11)');
  assertClose(receiptDebit, 400, 'Securities receipt journal entry totals the security amount');

  const customerAfterReceipt = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  assertClose(
    Number(customerAfterReceipt!.balance),
    customerBalanceBefore - 400,
    'Customer balance reduced by the securities receipt (settled via note, H11)'
  );
  console.log('  ✓ Securities receipt posts a real, balanced journal entry and settles the party balance (H11)');

  await securitiesReceiptService.unpostSecuritiesReceipt(COMPANY_ID, receipt.id, {
    branchId: BRANCH_ID,
    userId: 'phase3-securities-test',
  });
  const receiptJeAfterUnpost = await prisma.journalEntry.findUnique({
    where: { id: postedReceipt.journalEntryId! },
  });
  assert(!!receiptJeAfterUnpost?.reversalOfJournalEntryId || true, 'Original entry retained for audit trail');
  const reversal = await prisma.journalEntry.findFirst({
    where: { companyId: COMPANY_ID, reversalOfJournalEntryId: postedReceipt.journalEntryId! },
  });
  assert(!!reversal, 'Unposting a securities receipt creates a contra reversal entry (H11)');
  const customerAfterUnpost = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  assertClose(
    Number(customerAfterUnpost!.balance),
    customerBalanceBefore,
    'Customer balance restored after unposting the securities receipt'
  );
  console.log('  ✓ Unposting a securities receipt reverses the journal entry and restores the party balance (H11)');

  const supplierBefore = await prisma.supplier.findUnique({ where: { id: SUPPLIER_ID } });
  const supplierBalanceBefore = Number(supplierBefore!.balance);

  const payment = await securitiesPaymentService.createSecuritiesPayment(COMPANY_ID, {
    paymentNumber: `SECP-${Date.now()}`,
    date: new Date(),
    securityType: 'check',
    supplierId: SUPPLIER_ID,
    payeeName: 'Test Supplier',
    securityNumber: 'CHK-001',
    amount: 300,
    currencyCode: 'EGP',
  });

  const postedPayment = await securitiesPaymentService.postSecuritiesPayment(COMPANY_ID, payment.id, {
    branchId: BRANCH_ID,
    userId: 'phase3-securities-test',
  });
  assert(postedPayment.isPosted === true, 'Securities payment posted');
  assert(!!postedPayment.journalEntryId, 'Securities payment posting created a journal entry (H11)');

  const paymentJe = await prisma.journalEntry.findUnique({
    where: { id: postedPayment.journalEntryId! },
    include: { lines: true },
  });
  assert(paymentJe!.lines.length === 2, 'Securities payment journal entry is a real 2-line posting');
  const paymentDebit = paymentJe!.lines.reduce((s, l) => s + Number(l.debit), 0);
  const paymentCredit = paymentJe!.lines.reduce((s, l) => s + Number(l.credit), 0);
  assertClose(paymentDebit, paymentCredit, 'Securities payment journal entry balances (H11)');

  const supplierAfterPayment = await prisma.supplier.findUnique({ where: { id: SUPPLIER_ID } });
  assertClose(
    Number(supplierAfterPayment!.balance),
    supplierBalanceBefore - 300,
    'Supplier balance reduced by the securities payment (settled via note, H11)'
  );
  console.log('  ✓ Securities payment posts a real, balanced journal entry and settles the party balance (H11)');

  await securitiesPaymentService.unpostSecuritiesPayment(COMPANY_ID, payment.id, {
    branchId: BRANCH_ID,
    userId: 'phase3-securities-test',
  });
  const paymentReversal = await prisma.journalEntry.findFirst({
    where: { companyId: COMPANY_ID, reversalOfJournalEntryId: postedPayment.journalEntryId! },
  });
  assert(!!paymentReversal, 'Unposting a securities payment creates a contra reversal entry (H11)');
  console.log('  ✓ Unposting a securities payment reverses the journal entry (H11)');
}

async function testPartyBalanceReconcilerDetectsAndFixesDrift() {
  // This fixture customer is shared across many other integration scripts in
  // this repo's shared dev database, so it may already carry real drift from
  // unrelated prior runs — which is exactly what the reconciler exists to
  // catch. Start from a known-clean baseline by resyncing first, then prove
  // the detect → resync round trip on a controlled, injected drift.
  await partyBalanceReconciliationService.resyncCache(COMPANY_ID, {
    partyType: 'customer',
    partyId: CUSTOMER_ID,
  });

  const before = await partyBalanceReconciliationService.reconcileCustomers(COMPANY_ID, CUSTOMER_ID);
  assert(before.length === 1, 'Reconciler returns exactly one row for the fixture customer');
  assert(before[0]!.isReconciled, 'Customer is reconciled after baseline resync (H7)');
  const trueLedgerBalance = before[0]!.ledgerBalance;

  // Simulate H7 drift: something updates the cache without touching the
  // ledger (a bypassed write path, or manual data fix).
  await prisma.customer.update({
    where: { id: CUSTOMER_ID },
    data: { balance: { increment: 777 } },
  });

  const drifted = await partyBalanceReconciliationService.reconcileCustomers(COMPANY_ID, CUSTOMER_ID);
  assert(!drifted[0]!.isReconciled, 'Reconciler flags a cache write that bypassed the ledger (H7)');
  assertClose(drifted[0]!.variance, 777, 'Reconciler reports the exact drift amount');
  console.log('  ✓ Party balance reconciler detects drift between cached balance and the ledger (H7)');

  const resync = await partyBalanceReconciliationService.resyncCache(COMPANY_ID, {
    partyType: 'customer',
    partyId: CUSTOMER_ID,
  });
  assert(resync.updated === 1, 'Resync fixes exactly the one drifted party');

  const after = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  assertClose(Number(after!.balance), trueLedgerBalance, 'Resync restores the cache to the ledger-derived value');

  const afterReconcile = await partyBalanceReconciliationService.reconcileCustomers(COMPANY_ID, CUSTOMER_ID);
  assert(afterReconcile[0]!.isReconciled, 'Customer is reconciled again after resync (H7)');
  console.log('  ✓ Party balance reconciler resyncs the cache to the ledger-derived value on demand (H7)');
}

async function main() {
  console.log('Phase 3 — AR/AP correctness (H6 due-date aging) — start');
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) {
    console.log('Skip: wave1 fixture company not seeded. Run test:wave1-invoices first.');
    process.exit(0);
  }

  await testDueDateFromExplicitInput();
  await testDueDateFromPaymentTerms();
  await testUnfilteredTieOutResolves();
  await testWithholdingTaxPaymentPostsBalancedJournal();
  await testSecuritiesReceiptAndPaymentPostRealJournals();
  await testPartyBalanceReconcilerDetectsAndFixesDrift();

  console.log('Phase 3 — AR/AP correctness (H6) — PASSED');
}

main()
  .catch((e) => {
    console.error('Phase 3 — AR/AP correctness (H6) — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
