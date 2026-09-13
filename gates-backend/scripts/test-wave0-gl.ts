/**
 * Wave 0 — M0/M1 GL integration smoke test (direct services + Prisma).
 * Run: npm run test:wave0-gl
 */
import { PrismaClient } from '@prisma/client';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const TEST_USER = 'wave0-test-user';

const SETTINGS: Record<string, string> = {
  GLPost: 'T',
  GLUnPost: 'T',
  SaveUnbalanced: 'F',
  SerialGL: 'Y',
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function seedWave0Basics() {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: { isActive: true },
    create: {
      id: COMPANY_ID,
      arabicName: 'شركة اختبار Wave0',
      englishName: 'Wave0 Test Company',
      isActive: true,
    },
  });

  await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: { deletedAt: null },
    create: {
      id: BRANCH_ID,
      companyId: COMPANY_ID,
      arabicName: 'فرع رئيسي',
      legacyBranchCode: '01',
    },
  });

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59));

  await prisma.fiscalYear.upsert({
    where: {
      companyId_legacyYearId: {
        companyId: COMPANY_ID,
        legacyYearId: String(now.getUTCFullYear()),
      },
    },
    update: { status: 'Open', startDate: yearStart, endDate: yearEnd },
    create: {
      id: FISCAL_YEAR_ID,
      companyId: COMPANY_ID,
      legacyYearId: String(now.getUTCFullYear()),
      arabicName: `السنة ${now.getUTCFullYear()}`,
      startDate: yearStart,
      endDate: yearEnd,
      status: 'Open',
    },
  });

  for (const [name, value] of Object.entries(SETTINGS)) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  const accountDefs = [
    { code: '1000', arabicName: 'الصندوق', accountType: 'asset' },
    { code: '3000', arabicName: 'حقوق الملكية', accountType: 'equity' },
  ];

  for (const a of accountDefs) {
    const existing = await prisma.account.findFirst({
      where: { companyId: COMPANY_ID, code: a.code },
    });
    if (!existing) {
      await prisma.account.create({
        data: {
          companyId: COMPANY_ID,
          code: a.code,
          arabicName: a.arabicName,
          accountType: a.accountType,
          isActive: true,
        },
      });
    }
  }

  await prisma.currency.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: 'SAR' } },
    update: {},
    create: {
      companyId: COMPANY_ID,
      code: 'SAR',
      arabicName: 'ريال',
      isActive: true,
    },
  });

  const debit = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '1000' },
  });
  const credit = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '3000' },
  });
  assert(!!debit && !!credit, 'Seed accounts 1000/3000');

  return { debitAccountId: debit!.id, creditAccountId: credit!.id };
}

async function main() {
  console.log('Wave0 GL integration test — start');

  const { debitAccountId, creditAccountId } = await seedWave0Basics();

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { companyId: COMPANY_ID, status: 'Open' },
  });
  assert(!!fiscalYear, 'Open fiscal year exists');

  const ctx = {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: fiscalYear!.id,
    userId: TEST_USER,
  };

  const entry = await journalPostingService.createJournalEntry(ctx, {
    date: new Date(),
    description: 'Wave0 balanced test entry',
    currencyCode: 'SAR',
    lines: [
      {
        accountId: debitAccountId,
        debit: 1000,
        credit: 0,
        lineOrder: 1,
      },
      {
        accountId: creditAccountId,
        debit: 0,
        credit: 1000,
        lineOrder: 2,
      },
    ],
  });

  assert(!!entry, 'Journal entry created');
  assert(!!entry!.legacyGlNum, 'legacyGlNum assigned');
  assert(/^\d{8}$/.test(entry!.legacyGlNum!), `legacyGlNum format: ${entry!.legacyGlNum}`);
  assert(entry!.isBalanced === true, 'isBalanced true');
  assert(entry!.postingStatus === 'UnPost', 'starts UnPost');

  const posted = await journalPostingService.postJournalEntry(ctx, entry!.id);
  assert(posted.isPosted === true, 'isPosted after post');
  assert(posted.postingStatus === 'Post', 'postingStatus Post');
  assert(!!posted.postedAt, 'postedAt set');

  // Under the immutable-ledger design (C11 fix), "unposting" a journal entry
  // creates a contra reversal entry rather than mutating the original. The
  // original entry remains posted forever, and a linked reversal entry with
  // swapped debits/credits brings the net GL impact to zero.
  const unposted = await journalPostingService.unpostJournalEntry(ctx, entry!.id);
  assert(unposted.isPosted === true, 'original stays posted after unpost (contra reversal)');
  assert(unposted.postingStatus === 'Post', 'original postingStatus stays Post');
  assert(!!unposted.reversal, 'reversal entry created');
  assert(unposted.reversal.isPosted === true, 'reversal entry is posted');
  assert(unposted.reversal.reversalOfJournalEntryId === entry!.id, 'reversal links to original');

  console.log('Wave0 GL integration test — PASSED');
  console.log({
    journalEntryId: entry!.id,
    legacyGlNum: entry!.legacyGlNum,
  });
}

main()
  .catch((e) => {
    console.error('Wave0 GL integration test — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
