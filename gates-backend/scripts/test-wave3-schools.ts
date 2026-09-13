/**
 * Wave 3 — M10 schools integration test.
 * Run: npm run test:wave3-schools
 */
import { PrismaClient } from '@prisma/client';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { treasuryPostingContextFromIds } from '../src/modules/treasury/services/treasury-posting-context.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { schoolStructureService } from '../src/modules/schools/services/school-structure.service.js';
import { studentEnrollmentService } from '../src/modules/schools/services/student-enrollment.service.js';
import { tuitionBillingService } from '../src/modules/schools/services/tuition-billing.service.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const SAFE_ID = '00000000-0000-0000-0000-000000000070';
const SCHOOL_CC_ID = '00000000-0000-0000-0000-0000000000d1';

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

async function ensureAccount(code: string, arabicName: string, type: string) {
  const existing = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code },
  });
  if (existing) return existing.id;
  return prisma.account
    .create({
      data: {
        companyId: COMPANY_ID,
        code,
        arabicName,
        accountType: type,
        isActive: true,
      },
    })
    .then((a) => a.id);
}

async function journalLineTotals(journalEntryId: string) {
  const lines = await prisma.journalEntryLine.findMany({
    where: { journalEntryId },
    include: { account: { select: { code: true } } },
  });
  const byCode: Record<string, number> = {};
  for (const l of lines) {
    const code = l.account.code;
    byCode[code] = (byCode[code] ?? 0) + Number(l.debit) - Number(l.credit);
  }
  return byCode;
}

async function seedSchoolFixtures() {
  for (const [name, value] of Object.entries({
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
  })) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  const cashGl = await ensureAccount('1100', 'Cash Box', 'asset');
  await ensureAccount('1220', 'Student AR', 'asset');
  await ensureAccount('2480', 'Unearned Tuition', 'liability');
  await ensureAccount('4150', 'Earned Tuition Revenue', 'revenue');
  await ensureAccount('5160', 'Tuition Discounts', 'expense');
  await ensureAccount('4160', 'Bus Revenue', 'revenue');
  await ensureAccount('4170', 'Books Revenue', 'revenue');

  await prisma.schoolSettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {},
    create: {
      companyId: COMPANY_ID,
      studentArAccountCode: '1220',
      unearnedTuitionRevenueAccountCode: '2480',
      earnedTuitionRevenueAccountCode: '4150',
      tuitionDiscountAccountCode: '5160',
      busRevenueAccountCode: '4160',
      booksRevenueAccountCode: '4170',
    },
  });

  const existingCc = await prisma.costCenter.findFirst({
    where: { companyId: COMPANY_ID, code: 'SCH-GR-01' },
  });
  if (!existingCc) {
    await prisma.costCenter.create({
      data: {
        id: SCHOOL_CC_ID,
        companyId: COMPANY_ID,
        code: 'SCH-GR-01',
        arabicName: 'Primary Stage CC',
      },
    });
  }

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

  const customer = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  assert(!!customer, 'Run test:wave1-invoices first for guardian customer');
}

async function main() {
  console.log('Wave3 M10 schools — start');
  await seedSchoolFixtures();

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave3-schools-test',
  });
  const treasuryCtx = treasuryPostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave3-schools-test',
  });

  const cc = await prisma.costCenter.findFirst({
    where: { companyId: COMPANY_ID, code: 'SCH-GR-01' },
  });

  const year = await schoolStructureService.createAcademicYear(COMPANY_ID, {
    yearCode: `AY-${Date.now()}`,
    name: '2025/2026',
    terms: [
      {
        termCode: 'T1',
        termName: 'Term 1',
        startDate: new Date('2025-09-01'),
        sortOrder: 1,
      },
      {
        termCode: 'T2',
        termName: 'Term 2',
        startDate: new Date('2026-01-15'),
        sortOrder: 2,
      },
    ],
  });

  const grade = await schoolStructureService.createGrade(COMPANY_ID, {
    stageName: 'Primary',
    gradeName: 'Grade 4',
    gradeCode: `G4-${Date.now()}`,
    defaultTuitionFee: 30_000,
    costCenterId: cc?.id,
  });

  const busRoute = await schoolStructureService.createBusRoute(COMPANY_ID, {
    routeCode: `BUS-${Date.now()}`,
    name: 'North Route',
    annualFee: 5_000,
  });

  const student = await studentEnrollmentService.enroll(COMPANY_ID, {
    studentCode: `ST-${Date.now()}`,
    fullName: 'Ahmed Ali',
    guardianCustomerId: CUSTOMER_ID,
    gradeId: grade.id,
    academicYearId: year!.id,
    busRouteId: busRoute.id,
  });

  const tuition = 30_000;
  const bus = 5_000;
  const books = 2_000;
  const siblingDiscount = 3_000;
  const gross = tuition + bus + books;
  const net = gross - siblingDiscount;
  const tuitionNet = tuition - siblingDiscount;

  const contract = await tuitionBillingService.createFeeContract(COMPANY_ID, {
    studentId: student.id,
    contractNumber: `SFC-${Date.now()}`,
    tuitionFee: tuition,
    busFee: bus,
    booksFee: books,
    totalDiscount: siblingDiscount,
  });

  assert(contract!.installments.length === 2, 'Two term installments');

  const accrued = await tuitionBillingService.postFeeAccrual(ctx, contract!.id);
  await assertJournalPostedBalanced(accrued!.accrualJournalEntryId!);
  assertClose(Number(accrued!.outstandingArBalance), net, 'Guardian AR outstanding');
  assertClose(Number(accrued!.unearnedTuitionBalance), tuitionNet, 'Unearned tuition');

  const accrualJe = await journalLineTotals(accrued!.accrualJournalEntryId!);
  assertClose(accrualJe['1220'] ?? 0, net, 'Accrual — student AR');
  assertClose(accrualJe['5160'] ?? 0, siblingDiscount, 'Accrual — discount debit');
  assertClose(accrualJe['2480'] ?? 0, -tuition, 'Accrual — unearned tuition');
  assertClose(accrualJe['4160'] ?? 0, -bus, 'Accrual — bus revenue');
  assertClose(accrualJe['4170'] ?? 0, -books, 'Accrual — books revenue');

  const customerBefore = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  const inst1 = contract!.installments[0];
  const afterCollect = await tuitionBillingService.collectInstallment(
    ctx,
    treasuryCtx,
    inst1.id,
    { safeId: SAFE_ID, voucherNumber: `SCH-PAY-${Date.now()}` }
  );
  assertClose(
    Number(afterCollect!.outstandingArBalance),
    net - Number(inst1.amount),
    'AR after installment'
  );
  const customerAfter = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  assertClose(
    Number(customerAfter!.balance) - Number(customerBefore!.balance),
    -Number(inst1.amount),
    'Guardian balance reduced'
  );

  const termRecognize = tuitionNet / 2;
  const recognized = await tuitionBillingService.recognizeTermRevenue(ctx, contract!.id, {
    amount: termRecognize,
  });
  await assertJournalPostedBalanced(recognized!.recognitionJournalEntryId!);
  assertClose(
    Number(recognized!.unearnedTuitionBalance),
    tuitionNet - termRecognize,
    'Unearned after term 1'
  );

  const recJe = await journalLineTotals(recognized!.recognitionJournalEntryId!);
  assertClose(recJe['2480'] ?? 0, termRecognize, 'Recognition — unearned debited');
  assertClose(recJe['4150'] ?? 0, -termRecognize, 'Recognition — earned tuition P&L');

  console.log('Wave3 M10 schools — PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
