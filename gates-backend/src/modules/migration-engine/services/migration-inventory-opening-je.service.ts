import { Decimal } from '@prisma/client/runtime/library';
import type { MigrationContext } from '../migration-context';
import { money, money2 } from '../accounting/journal-money';
import {
  readInventoryCutoverPolicy,
  type MigrationInventoryCutoverPolicy,
} from '../policies/migration-inventory-cutover-policy';
import { legacyTrim } from '../transforms/legacy-values';

export type InventoryOpeningJeResult =
  | { status: 'SKIPPED_POLICY' }
  | { status: 'PENDING_OWNER_APPROVAL'; subledgerValue: string; message: string }
  | { status: 'DRAFT_CREATED'; journalEntryId: string; debit: string; credit: string }
  | { status: 'ALREADY_MAPPED'; journalEntryId: string };

function readOpeningJeApproved(progress: unknown): boolean {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return false;
  return Boolean((progress as Record<string, unknown>).inventoryOpeningJeApproved);
}

async function sumInventorySubledger(ctx: MigrationContext): Promise<Decimal> {
  const rows = await ctx.prisma.inventoryMovement.groupBy({
    by: ['itemId', 'warehouseId'],
    where: { companyId: ctx.targetCompanyId },
    _sum: { quantityDelta: true },
  });
  let total = money(0);
  for (const row of rows) {
    const qty = money(row._sum.quantityDelta ?? 0);
    if (qty.isZero()) continue;
    const lastCost = await ctx.prisma.itemCostHistory.findFirst({
      where: { companyId: ctx.targetCompanyId, itemId: row.itemId },
      orderBy: { effectiveAt: 'desc' },
      select: { cost: true },
    });
    const unit = money(lastCost?.cost ?? 0);
    total = total.add(qty.mul(unit));
  }
  return total;
}

async function resolveInventoryGlAccountId(ctx: MigrationContext): Promise<string | null> {
  const settings = await ctx.prisma.companySettings.findUnique({
    where: { companyId: ctx.targetCompanyId },
    select: { accountDefinitions: true },
  });
  const defs = settings?.accountDefinitions as Record<string, string> | null;
  const code = legacyTrim(defs?.FirstTimeAccount ?? defs?.CostAccount ?? '');
  if (!code) return null;
  const map = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
    companyCode: ctx.legacyCompanyCode,
    accountCode: code,
  });
  return map?.targetId ?? null;
}

async function resolveOffsetEquityAccountId(ctx: MigrationContext): Promise<string | null> {
  const settings = await ctx.prisma.companySettings.findUnique({
    where: { companyId: ctx.targetCompanyId },
    select: { retainedEarningsAccountId: true, accountDefinitions: true },
  });
  if (settings?.retainedEarningsAccountId) return settings.retainedEarningsAccountId;
  const defs = settings?.accountDefinitions as Record<string, string> | null;
  const code = legacyTrim(defs?.ProfitAccount ?? '');
  if (!code) return null;
  const map = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
    companyCode: ctx.legacyCompanyCode,
    accountCode: code,
  });
  return map?.targetId ?? null;
}

/**
 * Owner-approved, idempotent DRAFT opening inventory JE — never auto-posted.
 */
export async function maybeCreateInventoryOpeningJournal(
  ctx: MigrationContext
): Promise<InventoryOpeningJeResult> {
  const job = await ctx.jobs.getJob(ctx.migrationJobId);
  const policy = readInventoryCutoverPolicy(job?.progress) as MigrationInventoryCutoverPolicy | null;
  if (policy !== 'PERPETUAL_WITH_OWNER_OPENING_STOCK_JE') {
    return { status: 'SKIPPED_POLICY' };
  }

  const existing = await ctx.idMap.findMapping(ctx.migrationJobId, 'InventoryOpeningJE', {
    companyCode: ctx.legacyCompanyCode,
  });
  if (existing) {
    return { status: 'ALREADY_MAPPED', journalEntryId: existing.targetId };
  }

  const subledgerValue = await sumInventorySubledger(ctx);
  if (subledgerValue.lte(0)) {
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: 'INVENTORY',
      severity: 'WARNING',
      category: 'INVENTORY_OPENING_JE_NO_SUBLEDGER',
      description: 'PERPETUAL_WITH_OWNER_OPENING_STOCK_JE selected but MAC subledger value is zero — no opening JE created.',
    });
    return {
      status: 'PENDING_OWNER_APPROVAL',
      subledgerValue: money2(subledgerValue),
      message: 'Subledger value is zero; approve only after movements/costs import.',
    };
  }

  if (!readOpeningJeApproved(job?.progress)) {
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: 'INVENTORY',
      severity: 'INFO',
      category: 'INVENTORY_OPENING_JE_AWAITING_APPROVAL',
      description: `Opening inventory JE requires inventoryOpeningJeApproved on job settings. Proven subledger value=${money2(subledgerValue)}.`,
    });
    return {
      status: 'PENDING_OWNER_APPROVAL',
      subledgerValue: money2(subledgerValue),
      message: 'Enable inventory opening JE approval on migration settings after owner review.',
    };
  }

  const inventoryAccountId = await resolveInventoryGlAccountId(ctx);
  const offsetAccountId = await resolveOffsetEquityAccountId(ctx);
  if (!inventoryAccountId || !offsetAccountId) {
    await ctx.issues.record({
      jobId: ctx.migrationJobId,
      stage: 'INVENTORY',
      severity: 'BLOCKER',
      category: 'INVENTORY_OPENING_JE_ACCOUNTS_UNRESOLVED',
      description:
        'Cannot build opening inventory JE — resolve FirstTimeAccount/CostAccount and retained earnings / ProfitAccount in COA map.',
    });
    return {
      status: 'PENDING_OWNER_APPROVAL',
      subledgerValue: money2(subledgerValue),
      message: 'GL accounts for inventory opening JE are not mapped.',
    };
  }

  if (ctx.dryRun) {
    return {
      status: 'DRAFT_CREATED',
      journalEntryId: 'dry-run',
      debit: money2(subledgerValue),
      credit: money2(subledgerValue),
    };
  }

  const amount = subledgerValue.toDecimalPlaces(2);
  const entry = await ctx.prisma.$transaction(async (tx) => {
    const je = await tx.journalEntry.create({
      data: {
        companyId: ctx.targetCompanyId,
        date: new Date(),
        description: 'Migration opening inventory (owner-approved draft — not posted)',
        descriptionAr: 'قيد افتتاح مخزون — ترحيل (مسودة)',
        currencyCode: 'EGP',
        exchangeRate: '1',
        isPosted: false,
        isBalanced: true,
        postingStatus: 'UnPost',
        workflowStatus: 'DRAFT',
        entryType: 'OPENING_INVENTORY_MIGRATION',
        sourceKind: 'MANUAL',
        createdBy: 'migration-inventory-opening',
      },
    });
    await tx.journalEntryLine.create({
      data: {
        journalEntryId: je.id,
        accountId: inventoryAccountId,
        debit: amount,
        credit: new Decimal(0),
        debitBase: amount,
        creditBase: new Decimal(0),
        lineNumber: 1,
        lineOrder: 1,
        description: 'Opening inventory subledger (MAC)',
      },
    });
    await tx.journalEntryLine.create({
      data: {
        journalEntryId: je.id,
        accountId: offsetAccountId,
        debit: new Decimal(0),
        credit: amount,
        debitBase: new Decimal(0),
        creditBase: amount,
        lineNumber: 2,
        lineOrder: 2,
        description: 'Opening inventory offset (migration)',
      },
    });
    return je;
  });

  await ctx.idMap.recordMapping({
    jobId: ctx.migrationJobId,
    sourceEntity: 'InventoryOpeningJE',
    sourceKeyParts: { companyCode: ctx.legacyCompanyCode },
    targetModel: 'JournalEntry',
    targetId: entry.id,
    outcome: 'CREATED_BY_MIGRATION',
    readOnly: true,
  });

  return {
    status: 'DRAFT_CREATED',
    journalEntryId: entry.id,
    debit: money2(amount),
    credit: money2(amount),
  };
}
