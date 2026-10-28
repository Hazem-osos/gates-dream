import type { MigrationContext } from '../migration-context';
import type { MigrationStageName, StageRunReport } from '../types';
import { preserveLegacySnapshot } from '../services/migration-legacy-snapshot-preserve.service';
import { IMPORTER_PRESERVE_CONFIG } from '../services/migration-core-importer-preserve-config';
import { legacyTableExists } from '../accounting-source-profile';
import {
  cashAllocationCursor,
  countCashInvoiceAllocationRows,
  loadCashInvoiceAllocationBatch,
} from '../services/legacy-settlement-data.service';
import { cashAllocationSourceKeyParts } from '../transforms/cheque-historical-transform';
import { decideHistoricalSettlementImport } from '../treasury/settlement-cheque-decision';
import { legacyDate, legacyTrim } from '../transforms/legacy-values';
import { money } from '../accounting/journal-money';
import { preserveUnappliedCashBalances } from '../services/migration-unapplied-cash.service';

const STAGE: MigrationStageName = 'SETTLEMENT_HISTORICAL';

export const SETTLEMENT_HISTORICAL_STAGE_DEPS: MigrationStageName[] = ['COMMERCIAL', 'TREASURY_HISTORICAL'];

export async function analyzeSettlementHistorical(ctx: MigrationContext) {
  const hasDetail = await legacyTableExists(ctx.source, 'CashTrxDetail');
  let allocationRows = 0;
  if (hasDetail) {
    try {
      allocationRows = await countCashInvoiceAllocationRows(ctx.source, ctx.legacyCompanyCode);
    } catch {
      allocationRows = -1;
    }
  }
  const hasSettlementTrx = await legacyTableExists(ctx.source, 'SettlementTrxHeader');
  if (hasSettlementTrx) {
    try {
      const n = await ctx.source.count('SettlementTrxHeader', ctx.legacyCompanyCode);
      if (n > 0) {
        await ctx.issues.recordOnce({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          severity: 'BLOCKER',
          category: 'SETTLEMENT_TRX_HEADER_UNSUPPORTED',
          description:
            'SettlementTrxHeader has rows but is not documented in erp_schema.txt — allocations must come from CashTrxDetail.Invoice* columns only.',
        });
      }
    } catch {
      /* ignore */
    }
  }
  return {
    hasCashTrxDetail: hasDetail,
    cashInvoiceAllocationRows: allocationRows,
    sourceEvidence: 'CashTrxDetail.InvoiceType / InvoiceYearId / InvoiceNum joined to posted CashTrxHeader',
  };
}

export async function runSettlementHistoricalStage(ctx: MigrationContext): Promise<StageRunReport> {
  const openBlock = await ctx.prisma.migrationIssue.findFirst({
    where: {
      migrationJobId: ctx.migrationJobId,
      category: 'SETTLEMENT_TRX_HEADER_UNSUPPORTED',
      resolutionState: 'OPEN',
      severity: 'BLOCKER',
    },
  });
  if (openBlock) {
    const openBlockers = await ctx.jobs.countOpenBlockers(ctx.migrationJobId);
    return {
      stage: STAGE,
      sourceCounts: { blockedSettlementTrxHeader: 1 },
      transformed: 0,
      written: 0,
      simulated: 0,
      warnings: 0,
      errors: 0,
      blockers: openBlockers,
    };
  }

  const batchSize = ctx.options.batchSize ?? 100;
  let cursor: string | null = null;
  let processed = 0;
  let written = 0;
  let skipped = 0;
  let inactive = 0;
  let blockers = 0;

  for (;;) {
    await ctx.throwIfPaused({ stage: STAGE, entity: 'CashTrxDetail' });
    const batch = await loadCashInvoiceAllocationBatch(ctx.source, ctx.legacyCompanyCode, cursor, batchSize);
    if (!batch.rows.length) break;
    cursor = batch.nextCursor;

    for (const row of batch.rows) {
      processed += 1;
      try {
        const sourceKey = cashAllocationSourceKeyParts(row, ctx.legacyCompanyCode);
        const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'CashTrxDetail', sourceKey);

        const cashMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'CashTrxHeader', {
          companyCode: ctx.legacyCompanyCode,
          branchCode: legacyTrim(row.BranchCode),
          yearId: legacyTrim(row.YearID),
          type: legacyTrim(row.Type),
          cashNum: legacyTrim(row.CashNum),
        });

        const invYear = legacyTrim(row.InvoiceYearId) || legacyTrim(row.YearID);
        const invoiceMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'InvoiceTrxHeader', {
          companyCode: ctx.legacyCompanyCode,
          branchCode: legacyTrim(row.BranchCode),
          yearId: invYear,
          type: legacyTrim(row.InvoiceType),
          invoiceNum: legacyTrim(row.InvoiceNum),
        });

        const decision = decideHistoricalSettlementImport({
          row,
          cashTransactionId: cashMap?.targetId ?? null,
          invoiceId: invoiceMap?.targetId ?? null,
          alreadyMapped: Boolean(existingMap),
        });

        if (decision.action === 'SKIP_ALREADY_MAPPED') {
          skipped += 1;
          continue;
        }
        if (decision.action === 'SKIP_INACTIVE') {
          inactive += 1;
          continue;
        }
        if (decision.action === 'BLOCK') {
          blockers += 1;
          await ctx.issues.recordOnce({
            jobId: ctx.migrationJobId,
            stage: STAGE,
            severity: 'WARNING',
            category: decision.category,
            sourceEntity: 'CashTrxDetail',
            sourceKey: cashAllocationCursor(row),
            description: decision.reason,
          });
          continue;
        }

        if (ctx.dryRun) {
          written += 1;
          continue;
        }

        const allocatedAmount = money(row.Amount);
        const allocatedAt = legacyDate(row.CashDate) ?? new Date();

        // Reuse an identical allocation only if no other source line of this job owns it:
        // a voucher may legitimately allocate the same amount to the same invoice twice.
        const candidates = await ctx.prisma.paymentAllocation.findMany({
          where: {
            companyId: ctx.targetCompanyId,
            cashTransactionId: cashMap!.targetId,
            invoiceId: invoiceMap!.targetId,
            allocatedAmount,
          },
          select: { id: true },
        });
        const owned = candidates.length
          ? await ctx.prisma.migrationIdMap.findMany({
              where: {
                migrationJobId: ctx.migrationJobId,
                targetModel: 'PaymentAllocation',
                targetId: { in: candidates.map((c) => c.id) },
              },
              select: { targetId: true },
            })
          : [];
        const ownedIds = new Set(owned.map((o) => o.targetId));
        const dupId = candidates.find((c) => !ownedIds.has(c.id))?.id ?? null;
        const dup = dupId ? await ctx.prisma.paymentAllocation.findUnique({ where: { id: dupId } }) : null;

        const allocation = dup
          ? dup
          : await ctx.prisma.paymentAllocation.create({
              data: {
                companyId: ctx.targetCompanyId,
                cashTransactionId: cashMap!.targetId,
                invoiceId: invoiceMap!.targetId,
                allocatedAmount,
                allocatedAt,
              },
            });

        await ctx.idMap.recordMapping({
          jobId: ctx.migrationJobId,
          sourceEntity: 'CashTrxDetail',
          sourceKeyParts: sourceKey,
          targetModel: 'PaymentAllocation',
          targetId: allocation.id,
          outcome: dup ? 'ALREADY_MAPPED' : 'CREATED_BY_MIGRATION',
          readOnly: true,
        });
        await preserveLegacySnapshot(ctx, {
          namespace: IMPORTER_PRESERVE_CONFIG.CashTrxDetail.preserveNamespace,
          sourceKey: cashAllocationCursor(row),
          raw: row as Record<string, unknown>,
          mappedColumns: IMPORTER_PRESERVE_CONFIG.CashTrxDetail.mappedColumns,
        });
        written += 1;
      } catch (err) {
        blockers += 1;
        await ctx.issues.record({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          severity: 'ERROR',
          category: 'SETTLEMENT_IMPORT_ERROR',
          sourceEntity: 'CashTrxDetail',
          sourceKey: cashAllocationCursor(row),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await ctx.checkpoints.save({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      entity: 'CashTrxDetail',
      cursorKey: cursor,
      processedCount: BigInt(processed),
      successCount: BigInt(written),
      warningCount: BigInt(inactive),
      errorCount: BigInt(blockers),
    });

    if (!batch.nextCursor) break;
  }

  const unapplied = await preserveUnappliedCashBalances(ctx);

  const openBlockers = await ctx.jobs.countOpenBlockers(ctx.migrationJobId);
  return {
    stage: STAGE,
    sourceCounts: { processed, skipped, inactive, blockers, unappliedCash: unapplied.preserved },
    transformed: processed,
    written,
    simulated: ctx.dryRun ? written : 0,
    warnings: inactive,
    errors: blockers,
    blockers: openBlockers,
  };
}
