/**
 * Wave 3 — M12 real estate integration test.
 * Run: npm run test:wave3-real-estate
 */
import { PrismaClient } from '@prisma/client';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { treasuryPostingContextFromIds } from '../src/modules/treasury/services/treasury-posting-context.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { realEstateUnitService } from '../src/modules/real-estate/services/real-estate-unit.service.js';
import { unitContractService } from '../src/modules/real-estate/services/unit-contract.service.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const SAFE_ID = '00000000-0000-0000-0000-000000000070';
const RE_CC_ID = '00000000-0000-0000-0000-0000000000c1';

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

async function seedRealEstateFixtures() {
  for (const [name, value] of Object.entries({
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
  })) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  // The handover below books its JE on the contract's 2027 delivery date, but the shared
  // fixture company only has a fiscal year defined for 2026 — ensure the 2027 year exists
  // too, the way a real company would already have next year's fiscal year set up.
  await prisma.fiscalYear.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000e7' },
    update: { status: 'Open', isActive: true },
    create: {
      id: '00000000-0000-0000-0000-0000000000e7',
      companyId: COMPANY_ID,
      legacyYearId: 'RE2027',
      arabicName: 'RE Fixture FY2027',
      startDate: new Date('2027-01-01T00:00:00.000Z'),
      endDate: new Date('2027-12-31T23:59:59.000Z'),
      status: 'Open',
    },
  });

  const cashGl = await ensureAccount('1100', 'Cash Box', 'asset');
  await ensureAccount('1210', 'Real Estate AR', 'asset');
  await ensureAccount('2460', 'Unearned RE Revenue', 'liability');
  await ensureAccount('4100', 'Real Estate Revenue', 'revenue');
  await ensureAccount('2470', 'Maintenance Deposits', 'liability');
  await ensureAccount('4110', 'RE Penalty Revenue', 'revenue');

  await prisma.realEstateSettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {},
    create: {
      companyId: COMPANY_ID,
      realEstateArAccountCode: '1210',
      unearnedRealEstateRevenueAccountCode: '2460',
      realEstateRevenueAccountCode: '4100',
      maintenanceDepositsAccountCode: '2470',
      penaltyRevenueAccountCode: '4110',
    },
  });

  const existingCc = await prisma.costCenter.findFirst({
    where: { companyId: COMPANY_ID, code: 'RE-PRJ-01' },
  });
  if (!existingCc) {
    await prisma.costCenter.create({
      data: {
        id: RE_CC_ID,
        companyId: COMPANY_ID,
        code: 'RE-PRJ-01',
        arabicName: 'Real Estate Project CC',
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
  assert(!!customer, 'Run test:wave1-invoices first for customer fixture');
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

async function main() {
  console.log('Wave3 M12 real estate — start');
  await seedRealEstateFixtures();

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave3-real-estate-test',
  });
  const treasuryCtx = treasuryPostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave3-real-estate-test',
  });

  const cc = await prisma.costCenter.findFirst({
    where: { companyId: COMPANY_ID, code: 'RE-PRJ-01' },
  });

  const project = await realEstateUnitService.createProject(COMPANY_ID, {
    projectCode: `RE-${Date.now()}`,
    projectName: 'Sunrise Towers',
    costCenterId: cc?.id,
  });

  const building = await realEstateUnitService.createBuilding(COMPANY_ID, {
    projectId: project.id,
    buildingCode: 'T-A',
    name: 'Tower A',
    totalFloors: 12,
  });

  const unit = await realEstateUnitService.createUnit(COMPANY_ID, {
    buildingId: building.id,
    unitCode: 'U-101',
    floor: 1,
    grossArea: 100,
    meterPrice: 10000,
    totalPrice: 1_000_000,
    maintenanceDeposit: 50_000,
  });

  const contractDate = new Date('2026-01-01T00:00:00.000Z');
  const deliveryDate = new Date('2027-01-01T00:00:00.000Z');

  const contract = await unitContractService.createWithSchedule(COMPANY_ID, {
    unitId: unit.id,
    customerId: CUSTOMER_ID,
    contractNumber: `UC-${Date.now()}`,
    contractDate,
    deliveryDate,
    downPayment: 200_000,
    frequency: 'QUARTERLY',
    installmentCount: 4,
  });

  assert(contract!.installments.length === 5, 'Down + 4 quarterly installments');

  const posted = await unitContractService.postContractExecution(ctx, contract!.id);
  assert(!!posted!.contractJournalEntryId, 'Contract JE linked');
  await assertJournalPostedBalanced(posted!.contractJournalEntryId!);
  assertClose(Number(posted!.outstandingArBalance), 1_050_000, 'AR outstanding');
  assertClose(Number(posted!.unearnedRevenueBalance), 1_000_000, 'Unearned balance');

  const contractJe = await journalLineTotals(posted!.contractJournalEntryId!);
  assertClose(contractJe['1210'] ?? 0, 1_050_000, 'Contract JE — RE AR debit');
  assertClose(contractJe['2460'] ?? 0, -1_000_000, 'Contract JE — unearned credit');
  assertClose(contractJe['2470'] ?? 0, -50_000, 'Contract JE — maintenance liability');

  const firstInstallment = contract!.installments.find((i) => i.installmentNumber === 1);
  assert(!!firstInstallment, 'First quarterly installment');

  const customerBefore = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  const afterCollect = await unitContractService.collectInstallment(
    ctx,
    treasuryCtx,
    firstInstallment!.id,
    { safeId: SAFE_ID, voucherNumber: `RE-INST-${Date.now()}` }
  );
  assertClose(Number(afterCollect!.outstandingArBalance), 850_000, 'AR after 1 installment');

  const customerAfter = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  const customerDelta =
    Number(customerAfter!.balance) - Number(customerBefore!.balance);
  assertClose(customerDelta, -200_000, 'Customer balance reduced by installment');

  const handed = await unitContractService.handoverUnit(ctx, contract!.id, deliveryDate);
  assert(!!handed!.handoverJournalEntryId, 'Handover JE');
  await assertJournalPostedBalanced(handed!.handoverJournalEntryId!);
  assertClose(Number(handed!.unearnedRevenueBalance), 0, 'Unearned cleared');

  const handoverJe = await journalLineTotals(handed!.handoverJournalEntryId!);
  assertClose(handoverJe['2460'] ?? 0, 1_000_000, 'Handover JE — unearned debited');
  assertClose(handoverJe['4100'] ?? 0, -1_000_000, 'Handover JE — revenue credited');

  const unitAfter = await realEstateUnitService.getUnit(COMPANY_ID, unit.id);
  assert(unitAfter.status === 'DELIVERED', 'Unit delivered');

  console.log('Wave3 M12 real estate — PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
