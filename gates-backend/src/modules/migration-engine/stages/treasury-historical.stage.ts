import type { MigrationContext } from '../migration-context';
import type { MigrationStageName, StageRunReport } from '../types';
import { legacyTableExists } from '../accounting-source-profile';
import {
  cashHeaderCursor,
  loadCashTrxDetailsForHeader,
  loadPostedCashHeaderBatch,
} from '../services/legacy-commercial-data.service';
import { decideHistoricalCashImport } from '../commercial/commercial-document-decision';
import { resolveHistoricalJournalEntryId } from '../services/migration-journal-link.service';
import {
  cashDetailSourceKeyParts,
  cashSourceKeyParts,
  transformHistoricalCashHeader,
  transformHistoricalCashLine,
} from '../transforms/commercial-document-transform';
import { isActiveCashAllocationLine } from '../treasury/settlement-cheque-decision';
import { legacyTrim } from '../transforms/legacy-values';
import { bootstrapLegacyBankAccounts, resolveBankAccountIdForLegacyCode } from '../services/migration-bank-bootstrap.service';
import { loadCashTrxotherDetailForHeader } from '../services/legacy-foundation-ext.service';
import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';
import { preserveLegacyBankBoxRights } from '../services/migration-bank-box-rights.service';
import { preserveLegacySnapshot } from '../services/migration-legacy-snapshot-preserve.service';
import { IMPORTER_PRESERVE_CONFIG } from '../services/migration-core-importer-preserve-config';
import { buildPartyRefResolver } from '../services/migration-party-ref.service';

const STAGE: MigrationStageName = 'TREASURY_HISTORICAL';

export const TREASURY_HISTORICAL_STAGE_DEPS: MigrationStageName[] = ['ACCOUNTING', 'COMMERCIAL'];

export async function analyzeTreasuryHistorical(ctx: MigrationContext) {
  const hasCash = await legacyTableExists(ctx.source, 'CashTrxHeader');
  const sample = hasCash ? await loadPostedCashHeaderBatch(ctx.source, ctx.legacyCompanyCode, null, 100) : { rows: [], nextCursor: null };
  return {
    hasCash,
    cashSample: sample.rows.length,
    settlementNote: 'Invoice allocations imported in SETTLEMENT_HISTORICAL from CashTrxDetail.Invoice* (not SettlementTrxHeader).',
  };
}

export async function runTreasuryHistoricalStage(ctx: MigrationContext): Promise<StageRunReport> {
  const batchSize = ctx.options.batchSize ?? 100;
  let cursor: string | null = null;
  let processed = 0;
  let written = 0;
  let skipped = 0;
  let blockers = 0;

  await bootstrapLegacyBankAccounts(ctx);
  const parties = ctx.dryRun ? null : await buildPartyRefResolver(ctx);

  for (;;) {
    await ctx.throwIfPaused({ stage: STAGE, entity: 'CashTrxHeader' });
    const batch = await loadPostedCashHeaderBatch(ctx.source, ctx.legacyCompanyCode, cursor, batchSize);
    if (!batch.rows.length) break;
    cursor = batch.nextCursor;

    for (const row of batch.rows) {
      processed += 1;
      try {
        const sourceKey = cashSourceKeyParts(row, ctx.legacyCompanyCode);
        const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'CashTrxHeader', sourceKey);
        const journalEntryId = await resolveHistoricalJournalEntryId(
          ctx,
          legacyTrim(row.BranchCode),
          legacyTrim(row.YearID),
          row.GLNum
        );

        const decision = decideHistoricalCashImport({
          glNum: legacyTrim(row.GLNum),
          journalEntryId,
          alreadyMapped: Boolean(existingMap),
        });

        if (decision.action === 'SKIP_ALREADY_MAPPED') {
          skipped += 1;
          continue;
        }
        if (decision.action === 'BLOCK') {
          blockers += 1;
          await ctx.issues.recordOnce({
            jobId: ctx.migrationJobId,
            stage: STAGE,
            severity: 'WARNING',
            category: decision.category,
            sourceEntity: 'CashTrxHeader',
            sourceKey: cashHeaderCursor(row),
            description: decision.reason,
          });
          continue;
        }

        if (ctx.dryRun) {
          ctx.idMap.planMapping(ctx.migrationJobId, 'CashTrxHeader', sourceKey);
          written += 1;
          continue;
        }

        const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
          companyCode: ctx.legacyCompanyCode,
          branchCode: legacyTrim(row.BranchCode),
        });
        const yearMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Year', {
          companyCode: ctx.legacyCompanyCode,
          yearCode: legacyTrim(row.YearID),
        });
        const accountCode = legacyTrim(row.AccountCode);
        const details = await loadCashTrxDetailsForHeader(ctx.source, ctx.legacyCompanyCode, row);
        // The party is on the voucher lines (their AccountNo is the party leaf), or on the header.
        let customerId = await parties!.customerId(accountCode);
        let supplierId = customerId ? null : await parties!.supplierId(accountCode);
        if (!customerId && !supplierId) {
          const lineCustomers = new Set<string>();
          const lineSuppliers = new Set<string>();
          for (const dl of details) {
            if (!isActiveCashAllocationLine(dl)) continue;
            const c = await parties!.customerId(dl.AccountNo);
            if (c) lineCustomers.add(c);
            const sp = c ? null : await parties!.supplierId(dl.AccountNo);
            if (sp) lineSuppliers.add(sp);
          }
          if (lineCustomers.size === 1 && lineSuppliers.size === 0) customerId = [...lineCustomers][0];
          if (lineSuppliers.size === 1 && lineCustomers.size === 0) supplierId = [...lineSuppliers][0];
        }

        const otherDetails = await loadCashTrxotherDetailForHeader(ctx.source, ctx.legacyCompanyCode, row);
        let bankAccountId: string | null = null;
        for (const od of otherDetails) {
          const bankNo = legacyTrim(od.BankAccountNo);
          if (bankNo) {
            bankAccountId = await resolveBankAccountIdForLegacyCode(ctx, bankNo);
            if (bankAccountId) break;
          }
        }
        if (!bankAccountId && accountCode) {
          const typ = legacyTrim(row.Type).toUpperCase();
          if (typ.startsWith('KP') || typ.startsWith('KR')) {
            bankAccountId = await resolveBankAccountIdForLegacyCode(ctx, accountCode);
          }
        }

        const data = transformHistoricalCashHeader(row, {
          companyId: ctx.targetCompanyId,
          branchId: branchMap?.targetId ?? null,
          fiscalYearId: yearMap?.targetId ?? null,
          customerId,
          supplierId,
          offsetAccountId: accountCode
            ? (await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
                companyCode: ctx.legacyCompanyCode,
                accountCode,
              }))?.targetId ?? null
            : null,
          bankAccountId,
          journalEntryId: journalEntryId!,
          invoiceId: null,
        });

        // Same voucher only if it is the same branch and the same journal: legacy numbers repeat
        // per branch and per type (KR01 #1 and BR01 #1 are both receipts).
        const existing = await ctx.prisma.cashTransaction.findFirst({
          where: {
            companyId: ctx.targetCompanyId,
            voucherNumber: data.voucherNumber,
            fiscalYearId: data.fiscalYearId,
            transactionKind: data.transactionKind,
            branchId: data.branchId,
            journalEntryId: data.journalEntryId,
          },
        });

        const cash = existing
          ? await ctx.prisma.cashTransaction.update({ where: { id: existing.id }, data })
          : await ctx.prisma.cashTransaction.create({ data });

        await ctx.idMap.recordMapping({
          jobId: ctx.migrationJobId,
          sourceEntity: 'CashTrxHeader',
          sourceKeyParts: sourceKey,
          targetModel: 'CashTransaction',
          targetId: cash.id,
          outcome: existing ? 'ALREADY_MAPPED' : 'CREATED_BY_MIGRATION',
          readOnly: true,
        });
        await preserveLegacySnapshot(ctx, {
          namespace: IMPORTER_PRESERVE_CONFIG.CashTrxHeader.preserveNamespace,
          sourceKey: cashHeaderCursor(row),
          raw: row as Record<string, unknown>,
          mappedColumns: IMPORTER_PRESERVE_CONFIG.CashTrxHeader.mappedColumns,
        });

        let lineOrder = 0;
        for (const dLine of details) {
          if (!isActiveCashAllocationLine(dLine)) continue;
          lineOrder += 1;
          const lineKey = cashDetailSourceKeyParts(dLine, ctx.legacyCompanyCode);
          if (await ctx.idMap.findMapping(ctx.migrationJobId, 'CashTrxDetailLine', lineKey)) continue;
          const accountCode = legacyTrim(dLine.AccountNo);
          if (!accountCode) continue;
          const accountMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
            companyCode: ctx.legacyCompanyCode,
            accountCode,
          });
          if (!accountMap) {
            await ctx.issues.recordOnce({
              jobId: ctx.migrationJobId,
              stage: STAGE,
              severity: 'BLOCKER',
              category: 'CASH_LINE_ACCOUNT_UNMAPPED',
              sourceEntity: 'CashTrxDetail',
              sourceKey: `${cashHeaderCursor(row)}|${legacyTrim(dLine.DetailNum)}`,
              description: `CashTrxDetail account ${accountCode} not in COA map`,
            });
            continue;
          }
          const ccCode = legacyTrim(dLine.CCenterCode);
          const ccMap = ccCode
            ? await ctx.idMap.findMapping(ctx.migrationJobId, 'CostCenter', {
                companyCode: ctx.legacyCompanyCode,
                code: ccCode,
              })
            : null;
          let invoiceId: string | null = null;
          const invNum = legacyTrim(dLine.InvoiceNum);
          if (invNum) {
            const invMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'InvoiceTrxHeader', {
              companyCode: ctx.legacyCompanyCode,
              branchCode: legacyTrim(dLine.BranchCode),
              yearId: legacyTrim(dLine.InvoiceYearId) || legacyTrim(dLine.YearID),
              type: legacyTrim(dLine.InvoiceType),
              invoiceNum: invNum,
            });
            invoiceId = invMap?.targetId ?? null;
          }
          const lineData = transformHistoricalCashLine(dLine, {
            companyId: ctx.targetCompanyId,
            cashTransactionId: cash.id,
            accountId: accountMap.targetId,
            costCenterId: ccMap?.targetId ?? null,
            invoiceId,
            lineOrder,
          });
          const createdLine = await ctx.prisma.cashTransactionLine.create({ data: lineData });
          await ctx.idMap.recordMapping({
            jobId: ctx.migrationJobId,
            sourceEntity: 'CashTrxDetailLine',
            sourceKeyParts: lineKey,
            targetModel: 'CashTransactionLine',
            targetId: createdLine.id,
            outcome: 'CREATED_BY_MIGRATION',
            readOnly: true,
          });
          await preserveLegacySnapshot(ctx, {
            namespace: IMPORTER_PRESERVE_CONFIG.CashTrxDetail.preserveNamespace,
            sourceKey: `${cashHeaderCursor(row)}|${legacyTrim(dLine.DetailNum)}`,
            raw: dLine as Record<string, unknown>,
            mappedColumns: IMPORTER_PRESERVE_CONFIG.CashTrxDetail.mappedColumns,
          });
        }

        let otherLineOrder = lineOrder;
        for (const od of otherDetails) {
          if (!isActiveCashAllocationLine(od)) continue;
          otherLineOrder += 1;
          const otherKey = {
            companyCode: ctx.legacyCompanyCode,
            branchCode: legacyTrim(od.BranchCode),
            yearId: legacyTrim(od.YearID),
            cashType: legacyTrim(od.Type),
            cashNum: legacyTrim(od.CashNum),
            detailNum: legacyTrim(od.DetailNum),
          };
          if (await ctx.idMap.findMapping(ctx.migrationJobId, 'CashTrxotherDetail', otherKey)) continue;
          const accountCode = legacyTrim(od.AccountNo);
          if (!accountCode) continue;
          const accountMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
            companyCode: ctx.legacyCompanyCode,
            accountCode: normalizeLegacyAccountCode(accountCode),
          });
          if (!accountMap) {
            await ctx.issues.recordOnce({
              jobId: ctx.migrationJobId,
              stage: STAGE,
              severity: 'BLOCKER',
              category: 'CASH_LINE_ACCOUNT_UNMAPPED',
              sourceEntity: 'CashTrxotherDetail',
              sourceKey: `${cashHeaderCursor(row)}|${legacyTrim(od.DetailNum)}`,
              description: `CashTrxotherDetail account ${accountCode} not in COA map`,
            });
            continue;
          }
          const ccCode = legacyTrim(od.CCenterCode);
          const ccMap = ccCode
            ? await ctx.idMap.findMapping(ctx.migrationJobId, 'CostCenter', {
                companyCode: ctx.legacyCompanyCode,
                code: ccCode,
              })
            : null;
          const lineData = transformHistoricalCashLine(od, {
            companyId: ctx.targetCompanyId,
            cashTransactionId: cash.id,
            accountId: accountMap.targetId,
            costCenterId: ccMap?.targetId ?? null,
            invoiceId: null,
            lineOrder: otherLineOrder,
            entrySide: 'CREDIT',
          });
          const createdOther = await ctx.prisma.cashTransactionLine.create({ data: lineData });
          await ctx.idMap.recordMapping({
            jobId: ctx.migrationJobId,
            sourceEntity: 'CashTrxotherDetail',
            sourceKeyParts: otherKey,
            targetModel: 'CashTransactionLine',
            targetId: createdOther.id,
            outcome: 'CREATED_BY_MIGRATION',
            readOnly: true,
          });
        }

        written += 1;
      } catch (err) {
        blockers += 1;
        await ctx.issues.record({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          severity: 'ERROR',
          category: 'CASH_IMPORT_ERROR',
          sourceEntity: 'CashTrxHeader',
          sourceKey: cashHeaderCursor(row),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await ctx.checkpoints.save({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      entity: 'CashTrxHeader',
      cursorKey: cursor,
      processedCount: BigInt(processed),
      successCount: BigInt(written),
      warningCount: BigInt(0),
      errorCount: BigInt(blockers),
    });

    if (!batch.nextCursor) break;
  }

  const bankBox = await preserveLegacyBankBoxRights(ctx);
  const openBlockers = await ctx.jobs.countOpenBlockers(ctx.migrationJobId);
  return {
    stage: STAGE,
    sourceCounts: { processed, skipped, blockers, bankBoxPreserved: bankBox.preserved },
    transformed: processed,
    written,
    simulated: ctx.dryRun ? written : 0,
    warnings: 0,
    errors: blockers,
    blockers: openBlockers,
  };
}
