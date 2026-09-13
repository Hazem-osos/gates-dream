/**
 * Wave 3 — M11/M13 contracting integration test.
 * Run: npm run test:wave3-contracting
 */
import { PrismaClient } from '@prisma/client';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { contractingProjectService } from '../src/modules/contracting/services/contracting-project.service.js';
import { clientExtractService } from '../src/modules/contracting/services/client-extract.service.js';
import { subcontractorExtractService } from '../src/modules/contracting/services/subcontractor-extract.service.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const COST_CENTER_ID = '00000000-0000-0000-0000-0000000000b1';
const CONTRACTOR_ID = '00000000-0000-0000-0000-0000000000b2';

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
  assert(!!entry, 'Journal exists');
  const totals = journalPostingService.computeBaseTotals(
    entry!.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
      exchangeRate: Number(l.exchangeRate),
    }))
  );
  assertClose(totals.debitBase, totals.creditBase, 'Journal balanced');
}

async function seedContractingFixtures() {
  const accounts = [
    { code: '4200', arabicName: 'Contracting Revenue', type: 'revenue' },
    { code: '5300', arabicName: 'Project Subcontract Expense', type: 'expense' },
    { code: '2430', arabicName: 'Customer Advances', type: 'liability' },
    { code: '1430', arabicName: 'Subcontractor Advances', type: 'asset' },
    { code: '1440', arabicName: 'Retention Held', type: 'asset' },
    { code: '2440', arabicName: 'Retention Withheld', type: 'liability' },
    { code: '1450', arabicName: 'WHT Asset', type: 'asset' },
    { code: '2450', arabicName: 'WHT Payable', type: 'liability' },
  ];
  for (const a of accounts) {
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

  await prisma.contractingSettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {},
    create: {
      companyId: COMPANY_ID,
      contractingRevenueAccountCode: '4200',
      projectExpenseAccountCode: '5300',
      clientReceivableAccountCode: '1200',
      subcontractorPayableAccountCode: '2100',
      customerAdvanceAccountCode: '2430',
      subcontractorAdvanceAccountCode: '1430',
      retentionHeldByOthersAccountCode: '1440',
      retentionWithheldForOthersAccountCode: '2440',
      outputVatAccountCode: '2300',
      whtAssetAccountCode: '1450',
      whtPayableAccountCode: '2450',
    },
  });

  const existingCc = await prisma.costCenter.findFirst({
    where: { companyId: COMPANY_ID, code: 'PRJ-01' },
  });
  if (!existingCc) {
    await prisma.costCenter.create({
      data: {
        id: COST_CENTER_ID,
        companyId: COMPANY_ID,
        code: 'PRJ-01',
        arabicName: 'Project Alpha CC',
      },
    });
  }

  await prisma.contractor.upsert({
    where: { id: CONTRACTOR_ID },
    update: { isActive: true },
    create: {
      id: CONTRACTOR_ID,
      companyId: COMPANY_ID,
      arabicName: 'Subcontractor Beta',
      serial: 'SUB-01',
    },
  });
}

async function main() {
  console.log('Wave3 contracting integration test — start');

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fiscalYear, 'Run test:wave1-invoices for fixtures');

  await seedContractingFixtures();

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave3-contracting-test',
  });

  const ccRow = await prisma.costCenter.findFirst({
    where: { companyId: COMPANY_ID, code: 'PRJ-01' },
  });
  assert(!!ccRow, 'Cost center seeded');
  const costCenterId = ccRow!.id;

  const project = await contractingProjectService.create(COMPANY_ID, {
    projectCode: `PRJ-${Date.now()}`,
    projectName: 'Highway Section A',
    customerId: CUSTOMER_ID,
    contractValue: 1_000_000,
    advancePaymentBalance: 100_000,
    advanceDeductionPercent: 10,
    retentionPercent: 5,
    costCenterId,
  });

  const sub = await contractingProjectService.addSubcontract(COMPANY_ID, project.id, {
    subcontractorId: CONTRACTOR_ID,
    subcontractValue: 400_000,
    advancePaymentBalance: 50_000,
    advanceRecoveryPercent: 10,
    retentionPercent: 5,
    scopeOfWork: 'Earthworks package',
  });

  const clientDraft = await clientExtractService.createDraft(COMPANY_ID, {
    projectId: project.id,
    extractNumber: `CE-${Date.now()}`,
    grossAmount: 200_000,
  });
  assertClose(Number(clientDraft.advanceDeductionAmount), 20_000, 'Client advance deduction');
  assertClose(Number(clientDraft.retentionAmount), 10_000, 'Client retention');
  assertClose(Number(clientDraft.vatAmount), 23_800, 'Client VAT');
  assertClose(Number(clientDraft.whtAmount), 2_000, 'Client WHT');
  assertClose(Number(clientDraft.netAmount), 191_800, 'Client net receivable');

  const clientPosted = await clientExtractService.post(ctx, clientDraft.id);
  assert(clientPosted.status === 'POSTED', 'Client extract posted');
  await assertJournalPostedBalanced(clientPosted.journalEntryId!);

  const clientJe = await prisma.journalEntry.findUnique({
    where: { id: clientPosted.journalEntryId! },
    include: { lines: { include: { account: true } } },
  });
  const revenueLine = clientJe!.lines.find(
    (l) => l.account.code === '4200' && Number(l.credit) > 0
  );
  assert(!!revenueLine, 'Revenue line posted');
  assert(revenueLine!.costCenterId === costCenterId, 'Revenue on project cost center');

  const projectAfter = await prisma.contractingProject.findUnique({
    where: { id: project.id },
  });
  assertClose(Number(projectAfter!.advancePaymentBalance), 80_000, 'Customer advance reduced');

  const subDraft = await subcontractorExtractService.createDraft(COMPANY_ID, {
    projectId: project.id,
    projectSubcontractId: sub.id,
    extractNumber: `SE-${Date.now()}`,
    grossAmount: 80_000,
  });
  assertClose(Number(subDraft.netAmount), 67_200, 'Subcontractor net payable');

  const subPosted = await subcontractorExtractService.post(ctx, subDraft.id);
  assert(subPosted.status === 'POSTED', 'Subcontractor extract posted');
  await assertJournalPostedBalanced(subPosted.journalEntryId!);

  const subJe = await prisma.journalEntry.findUnique({
    where: { id: subPosted.journalEntryId! },
    include: { lines: { include: { account: true } } },
  });
  const expenseLine = subJe!.lines.find(
    (l) => l.account.code === '5300' && Number(l.debit) > 0
  );
  assert(!!expenseLine, 'Project expense recognized');
  assert(expenseLine!.costCenterId === costCenterId, 'Expense on project cost center');

  const subAfter = await prisma.projectSubcontract.findUnique({ where: { id: sub.id } });
  assertClose(Number(subAfter!.advancePaymentBalance), 42_000, 'Subcontractor advance reduced');

  console.log('Wave3 contracting integration test — PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
