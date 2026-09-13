/**
 * Open-item allocation: pay 5000 EGP across two invoices (3000 + 2000) → both PAID.
 * Run: npm run test:payment-allocation
 */
import { PrismaClient } from '@prisma/client';
import { reconciliationService } from '../src/modules/accounting/services/reconciliation.service.js';
import { refreshInvoiceBalance } from '../src/modules/invoices/services/invoice-balance.service.js';
import { cashTransactionService } from '../src/modules/treasury/services/cash-transaction.service.js';
import { treasuryPostingService } from '../src/modules/treasury/services/treasury-posting.service.js';

const prisma = new PrismaClient();
const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) {
    console.log('Skip: Wave1 fixture company not seeded.');
    process.exit(0);
  }

  const customer = await prisma.customer.findFirst({
    where: { companyId: COMPANY_ID, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  assert(!!customer, 'Need an active customer');

  const safe = await prisma.safe.findFirst({
    where: { companyId: COMPANY_ID, isActive: true },
  });
  assert(!!safe, 'Need an active safe');

  const fy = await prisma.fiscalYear.findFirst({ where: { companyId: COMPANY_ID } });
  assert(!!fy, 'Need fiscal year');

  const suffix = Date.now();
  const makeInvoice = async (net: number, label: string) => {
    return prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        fiscalYearId: fy!.id,
        invoiceNumber: `ALLOC-TEST-${label}-${suffix}`,
        invoiceKind: 'SALE',
        invoiceType: 'sales',
        date: new Date(),
        currencyCode: 'EGP',
        customerId: customer!.id,
        netAmount: net,
        totalAmount: net,
        remainingAmount: net,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        isPosted: true,
        postedAt: new Date(),
      },
    });
  };

  const inv1 = await makeInvoice(3000, 'A');
  const inv2 = await makeInvoice(2000, 'B');

  const ctx = {
    companyId: COMPANY_ID,
    branchId: null as string | null,
    fiscalYearId: fy!.id,
    userId: 'test',
  };

  const cashTx = await cashTransactionService.create(COMPANY_ID, null, fy!.id, {
    transactionKind: 'RECEIPT',
    date: new Date(),
    description: `Allocation test ${suffix}`,
    amount: 5000,
    currencyCode: 'EGP',
    customerId: customer!.id,
    safeId: safe!.id,
  });

  await treasuryPostingService.postCashTransaction(ctx, cashTx.id);

  await reconciliationService.reconcileManual(COMPANY_ID, {
    cashTransactionId: cashTx.id,
    allocations: [
      { invoiceId: inv1.id, allocatedAmount: 3000 },
      { invoiceId: inv2.id, allocatedAmount: 2000 },
    ],
  });

  await refreshInvoiceBalance(COMPANY_ID, inv1.id);
  await refreshInvoiceBalance(COMPANY_ID, inv2.id);

  const updated = await prisma.invoice.findMany({
    where: { id: { in: [inv1.id, inv2.id] } },
    select: {
      paymentStatus: true,
      remainingAmount: true,
      paidAmount: true,
    },
  });

  for (const inv of updated) {
    assert(Number(inv.remainingAmount) <= 0.0001, `remaining should be 0, got ${inv.remainingAmount}`);
    assert(inv.paymentStatus === 'PAID', `expected PAID, got ${inv.paymentStatus}`);
  }

  await prisma.paymentAllocation.deleteMany({ where: { cashTransactionId: cashTx.id } });
  await prisma.cashTransaction.delete({ where: { id: cashTx.id } });
  await prisma.invoice.deleteMany({ where: { id: { in: [inv1.id, inv2.id] } } });

  console.log('Payment allocation scenario OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
