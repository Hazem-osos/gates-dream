/**
 * Maker-Checker: creator cannot approve their own manual journal when policy is on.
 * Run: npm run test:approval-maker-checker
 */
import { PrismaClient } from '@prisma/client';
import { approvalWorkflowService } from '../src/modules/accounting/services/approval-workflow.service.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import prisma from '../src/shared/database/prisma.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function ensureSetting(name: string, value: string) {
  await upsertCompanySetting(prisma, COMPANY_ID, name, value);
}

async function main() {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) {
    console.log('Skip: fixture company not seeded.');
    process.exit(0);
  }

  const branch = await prisma.branch.findFirst({ where: { companyId: COMPANY_ID } });
  const fy = await prisma.fiscalYear.findFirst({ where: { companyId: COMPANY_ID } });
  const user = await prisma.user.findFirst({ where: { companyId: COMPANY_ID } });
  assert(!!branch && !!fy && !!user, 'Need branch, fiscal year, and user');

  await ensureSetting('ApprovalEnforceMakerCheckerJournal', 'T');

  const makerId = user!.id;
  const ctx = {
    companyId: COMPANY_ID,
    branchId: branch!.id,
    fiscalYearId: fy!.id,
    userId: makerId,
  };

  const accounts = await prisma.account.findMany({
    where: { companyId: COMPANY_ID },
    take: 2,
    select: { id: true },
  });
  assert(accounts.length >= 2, 'Need two GL accounts');

  const entry = await journalPostingService.createJournalEntry(ctx, {
    date: new Date(),
    currencyCode: 'EGP',
    description: `Maker-checker test ${Date.now()}`,
    lines: [
      { accountId: accounts[0].id, debit: 100, credit: 0, lineOrder: 1 },
      { accountId: accounts[1].id, debit: 0, credit: 100, lineOrder: 2 },
    ],
  });

  assert(!!entry, 'Journal created');

  await approvalWorkflowService.submit(COMPANY_ID, 'JOURNAL_ENTRY', entry!.id, makerId);

  let blocked = false;
  try {
    await approvalWorkflowService.approve(COMPANY_ID, 'JOURNAL_ENTRY', entry!.id, makerId);
  } catch (e) {
    blocked = e instanceof Error && e.message.includes('Maker-Checker');
  }
  assert(blocked, 'Self-approval must be blocked');

  await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: entry!.id } });
  await prisma.journalEntry.delete({ where: { id: entry!.id } });

  console.log('Approval maker-checker OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
