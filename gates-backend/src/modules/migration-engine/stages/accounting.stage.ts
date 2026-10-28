import { Decimal } from '@prisma/client/runtime/library';
import { buildPartyRefResolver } from '../services/migration-party-ref.service';
import { decidePostedJournalImport } from '../accounting/journal-decision';
import { money, money2 } from '../accounting/journal-money';
import {
  openingDoubleCountReason,
  resolveOpeningImportPolicy,
  type OpeningImportPolicy,
} from '../accounting/opening-import-policy';
import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';
import type { MigrationContext } from '../migration-context';
import {
  countBalanceAccountHeaders,
  countCollapsedDuplicateHeaderGroups,
  countOpeningGlHeaders,
  countPostedJournalHeaders,
  journalCursorKey,
  linesForHeader,
  loadPostedJournalBatch,
  loadInvoiceReturnLinks,
  loadPostedJournalTotals,
} from '../services/legacy-journal-data.service';
import { loadOverrideMapForJob } from '../services/legacy-account-override.service';
import {
  assignUniqueLineNumbers,
  journalSourceKey,
  lineWritePayload,
  transformHistoricalJournalHeader,
  transformHistoricalJournalLine,
} from '../transforms/journal-transform';
import { legacyTrim, padGlNum } from '../transforms/legacy-values';
import type { MigrationStageName, StageRunReport } from '../types';
import { preserveLegacySnapshot } from '../services/migration-legacy-snapshot-preserve.service';
import { IMPORTER_PRESERVE_CONFIG } from '../services/migration-core-importer-preserve-config';
import { companySettingService } from '../../platform/services/company-setting.service';

const STAGE: MigrationStageName = 'ACCOUNTING';
export const ACCOUNTING_STAGE_DEPS: MigrationStageName[] = ['FOUNDATION', 'COA'];

export interface AccountingAnalyzeResult {
  postedHeaders: number;
  postedLines: number;
  uniqueLineIdentities: number;
  zeroValueDuplicatePhysicalRows: number;
  sourceDebit: string;
  sourceCredit: string;
  openingGlHeaders: number;
  balanceAccountHeaders: number;
  collapsedDuplicateHeaderGroups: number;
  openingPolicy: OpeningImportPolicy;
  openingPolicyReason: string;
}

export interface AccountingReconcileResult {
  sourceHeaders: number;
  importedHeaders: number;
  skipped: number;
  quarantined: number;
  sourcePhysicalLines: number;
  sourceUniqueLineIdentities: number;
  zeroValueDuplicatePhysicalRows: number;
  targetLines: number;
  sourceDebit: string;
  sourceCredit: string;
  targetDebit: string;
  targetCredit: string;
  difference: string;
  openingPolicy: OpeningImportPolicy;
  lineCountExplanation: string;
}

async function resolveAccountId(
  ctx: MigrationContext,
  legacyCode: string,
  overrideTargetCodes: Map<string, string>
): Promise<string | null> {
  const code = normalizeLegacyAccountCode(legacyCode);
  const mapped = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
    companyCode: ctx.legacyCompanyCode,
    accountCode: code,
  });
  if (mapped) return mapped.targetId;

  const overrideTarget = overrideTargetCodes.get(code);
  if (overrideTarget) {
    const viaTarget = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
      companyCode: ctx.legacyCompanyCode,
      accountCode: overrideTarget,
    });
    if (viaTarget) return viaTarget.targetId;
    const byCode = await ctx.prisma.account.findFirst({
      where: { companyId: ctx.targetCompanyId, code: overrideTarget, deletedAt: null },
      select: { id: true },
    });
    return byCode?.id ?? null;
  }

  const byCode = await ctx.prisma.account.findFirst({
    where: { companyId: ctx.targetCompanyId, code, deletedAt: null },
    select: { id: true },
  });
  return byCode?.id ?? null;
}

export async function analyzeAccounting(ctx: MigrationContext): Promise<AccountingAnalyzeResult> {
  const [postedHeaders, totals, openingGlHeaders, balanceAccountHeaders, collapsedDuplicateHeaderGroups] =
    await Promise.all([
      countPostedJournalHeaders(ctx.source, ctx.legacyCompanyCode),
      loadPostedJournalTotals(ctx.source, ctx.legacyCompanyCode),
      countOpeningGlHeaders(ctx.source, ctx.legacyCompanyCode),
      countBalanceAccountHeaders(ctx.source, ctx.legacyCompanyCode),
      countCollapsedDuplicateHeaderGroups(ctx.source, ctx.legacyCompanyCode),
    ]);
  const openingPolicy = resolveOpeningImportPolicy({
    balanceAccountHeaderCount: balanceAccountHeaders,
    openingGlHeaderCount: openingGlHeaders,
  });
  return {
    postedHeaders,
    postedLines: totals.lineCount,
    uniqueLineIdentities: totals.uniqueLineIdentities,
    zeroValueDuplicatePhysicalRows: totals.zeroValueDuplicatePhysicalRows,
    sourceDebit: totals.debit,
    sourceCredit: totals.credit,
    openingGlHeaders,
    balanceAccountHeaders,
    collapsedDuplicateHeaderGroups,
    openingPolicy,
    openingPolicyReason: openingDoubleCountReason(openingPolicy),
  };
}

export async function runAccountingStage(ctx: MigrationContext): Promise<StageRunReport> {
  const analysis = await analyzeAccounting(ctx);
  const parties = ctx.dryRun ? null : await buildPartyRefResolver(ctx);
  await ctx.issues.record({
    jobId: ctx.migrationJobId,
    stage: STAGE,
    severity: 'INFO',
    category: 'OPENING_POLICY',
    sourceEntity: 'BalanceAccountsH',
    description: analysis.openingPolicyReason,
  });
  if (analysis.balanceAccountHeaders > 0 && analysis.openingPolicy === 'GL_ONLY') {
    const rows = await ctx.source.querySql<Record<string, unknown>>(
      `SELECT BalanceAccount1, BalanceAccount2, BalanceAccount3, BalanceAccount4, BalanceAccount5
       FROM dbo.BalanceAccountsH WHERE RTRIM(CompanyCode)=@cc`,
      { cc: ctx.legacyCompanyCode }
    );
    for (const row of rows) {
      const slots = ['BalanceAccount1', 'BalanceAccount2', 'BalanceAccount3', 'BalanceAccount4', 'BalanceAccount5'] as const;
      for (const slot of slots) {
        const code = legacyTrim(row[slot]);
        if (!code) continue;
        const key = { companyCode: ctx.legacyCompanyCode, slot, accountCode: code };
        if (await ctx.idMap.findMapping(ctx.migrationJobId, 'BalanceAccountsH', key)) continue;
        if (!ctx.dryRun) {
          await companySettingService.setEntry(
            ctx.targetCompanyId,
            `legacyBalanceAccountsH.${slot}`,
            code
          );
          await ctx.idMap.recordMapping({
            jobId: ctx.migrationJobId,
            sourceEntity: 'BalanceAccountsH',
            sourceKeyParts: key,
            targetModel: 'CompanySettingEntry',
            targetId: ctx.targetCompanyId,
            outcome: 'BLOCKED',
            readOnly: true,
          });
        }
      }
    }
    const detailRows = await ctx.source
      .querySql<Record<string, unknown>>(
        `SELECT BalanceAccount1, BalanceAccount2 FROM dbo.BalanceAccountsD WHERE RTRIM(CompanyCode)=@cc`,
        { cc: ctx.legacyCompanyCode }
      )
      .catch(() => [] as Record<string, unknown>[]);
    for (const row of detailRows) {
      for (const slot of ['BalanceAccount1', 'BalanceAccount2'] as const) {
        const code = legacyTrim(row[slot]);
        if (!code) continue;
        const key = { companyCode: ctx.legacyCompanyCode, slot, accountCode: code };
        if (await ctx.idMap.findMapping(ctx.migrationJobId, 'BalanceAccountsD', key)) continue;
        if (!ctx.dryRun) {
          await companySettingService.setEntry(ctx.targetCompanyId, `legacyBalanceAccountsD.${slot}`, code);
          await ctx.idMap.recordMapping({
            jobId: ctx.migrationJobId,
            sourceEntity: 'BalanceAccountsD',
            sourceKeyParts: key,
            targetModel: 'CompanySettingEntry',
            targetId: ctx.targetCompanyId,
            outcome: 'BLOCKED',
            readOnly: true,
          });
        }
      }
    }
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      severity: 'INFO',
      category: 'BALANCE_ACCOUNTS_PRESERVED_NOT_POSTED',
      sourceEntity: 'BalanceAccountsH',
      description:
        `${analysis.balanceAccountHeaders} BalanceAccountsH row(s) preserved in CompanySettingEntry (legacyBalanceAccountsH.*) — not imported as GL to avoid double-count with BG01 opening journals.`,
    });
  }
  if (analysis.collapsedDuplicateHeaderGroups > 0) {
    await ctx.issues.record({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      severity: 'INFO',
      category: 'DUPLICATE_GLNUM_COLLAPSED',
      sourceEntity: 'GLTrxHeader',
      description: `${analysis.collapsedDuplicateHeaderGroups} posted header group(s) share Year+Branch+GlNum (typically invoice + cash receipt). Details are stored once and imported once so the ledger is not doubled.`,
    });
  }
  const reversalCols = await ctx.source.querySql<{ name: string }>(
    `SELECT c.name FROM sys.columns c
     JOIN sys.tables t ON t.object_id = c.object_id
     WHERE t.name = 'GLTrxHeader'
       AND (c.name LIKE '%Rev%' OR c.name LIKE '%Contra%' OR c.name LIKE '%CancelOf%')`
  );
  if (!reversalCols.length) {
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      severity: 'INFO',
      category: 'REVERSAL_LINKS_UNAVAILABLE',
      sourceEntity: 'GLTrxHeader',
      sourceKey: 'GLTrxHeader',
      description:
        'Legacy GLTrxHeader has no reversal/contra column. Historical import does not invent reversalOfJournalEntryId. Deleted=T headers remain excluded.',
    });
  }

  const overrideRows = await loadOverrideMapForJob(
    ctx.prisma,
    ctx.targetCompanyId,
    ctx.legacyCompanyCode
  );
  const overrideTargetCodes = new Map(
    [...overrideRows.entries()].map(([code, row]) => [code, row.targetLegacyAccountCode])
  );

  const batchSize = ctx.options.batchSize ?? 50;
  const cp = await ctx.checkpoints.load(ctx.migrationJobId, STAGE, 'GLTrxHeader');
  let cursor = cp?.cursorKey && cp.cursorKey !== '__DONE__' ? cp.cursorKey : null;
  if (cp?.cursorKey === '__DONE__') {
    return {
      stage: STAGE,
      sourceCounts: {
        postedHeaders: analysis.postedHeaders,
        postedLines: analysis.postedLines,
      },
      transformed: 0,
      written: 0,
      simulated: 0,
      warnings: 0,
      errors: 0,
      blockers: 0,
    };
  }

  let written = 0;
  let simulated = 0;
  let skipped = 0;
  const warnings = 0;
  let errors = 0;
  let processed = ctx.dryRun ? 0n : (cp?.processedCount ?? 0n);
  let lastCompletedCursor = cursor;

  const saveCheckpoint = async (cursorKey: string | null) => {
    if (ctx.dryRun) return;
    await ctx.checkpoints.save({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      entity: 'GLTrxHeader',
      cursorKey,
      processedCount: processed,
      successCount: BigInt(written),
      warningCount: BigInt(warnings),
      errorCount: BigInt(errors),
    });
  };

  for (;;) {
    await ctx.throwIfPaused({ stage: STAGE, entity: 'GLTrxHeader' });
    const batch = await loadPostedJournalBatch(ctx.source, ctx.legacyCompanyCode, cursor, batchSize);
    if (!batch.headers.length) break;

    for (const header of batch.headers) {
      if (processed % 10n === 0n) {
        await ctx.throwIfPaused({ stage: STAGE, entity: 'GLTrxHeader_lines' });
      }
      try {
      const glNum = padGlNum(header.GlNum ?? header.GLNum);
      const branchCode = legacyTrim(header.BranchCode);
      const yearId = legacyTrim(header.YearID);
      const key = journalSourceKey({
        companyCode: ctx.legacyCompanyCode,
        branchCode,
        yearId,
        glNum,
      });
      const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'GLTrxHeader', key);
      const detail = assignUniqueLineNumbers(
        linesForHeader(header, batch.lines).map(transformHistoricalJournalLine)
      );
      const debitBase = detail.reduce((sum, line) => sum.add(line.debitBase), money(0));
      const creditBase = detail.reduce((sum, line) => sum.add(line.creditBase), money(0));

      const unresolved: string[] = [];
      const accountIds = new Map<string, string>();
      for (const line of detail) {
        const id = await resolveAccountId(ctx, line.accountCode, overrideTargetCodes);
        if (!id) unresolved.push(line.accountCode);
        else accountIds.set(line.accountCode, id);
      }

      const decision = decidePostedJournalImport({
        isPosted: legacyTrim(header.Status).toLowerCase() === 'post',
        isDeleted: legacyTrim(header.Deleted).toUpperCase() === 'T',
        alreadyMapped: Boolean(existingMap),
        lineCount: detail.length,
        debitBase,
        creditBase,
        unresolvedAccountCodes: [...new Set(unresolved)],
      });

      if (decision.decision === 'SKIP_ALREADY_MAPPED' || decision.decision === 'SKIP_UNPOSTED' || decision.decision === 'SKIP_DELETED') {
        skipped += 1;
        continue;
      }

      if (decision.decision !== 'IMPORT') {
        errors += 1;
        await ctx.issues.record({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          severity: 'ERROR',
          category: decision.decision,
          sourceEntity: 'GLTrxHeader',
          sourceKey: `${yearId}|${branchCode}|${glNum}`,
          description: decision.difference
            ? `${decision.reason}; difference=${decision.difference}`
            : decision.reason,
        });
        continue;
      }

      if (ctx.dryRun) {
        ctx.idMap.planMapping(ctx.migrationJobId, 'GLTrxHeader', key);
        simulated += 1;
        continue;
      }

      const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
        companyCode: ctx.legacyCompanyCode,
        branchCode,
      });
      const yearMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Year', {
        companyCode: ctx.legacyCompanyCode,
        yearCode: yearId,
      });
      if (!branchMap || !yearMap) {
        // Never import a posted journal without its branch / fiscal year.
        errors += 1;
        await ctx.issues.recordOnce({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          severity: 'BLOCKER',
          category: !branchMap ? 'JOURNAL_BRANCH_UNMAPPED' : 'JOURNAL_YEAR_UNMAPPED',
          sourceEntity: 'GLTrxHeader',
          sourceKey: `${yearId}|${branchCode}|${glNum}`,
          description: !branchMap
            ? `Branch ${branchCode} of journal ${glNum} was not migrated`
            : `Fiscal year ${yearId} of journal ${glNum} was not migrated`,
        });
        continue;
      }
      const headerData = transformHistoricalJournalHeader(header, {
        companyId: ctx.targetCompanyId,
        branchId: branchMap?.targetId ?? null,
        fiscalYearId: yearMap?.targetId ?? null,
      });

      const existingTarget = await ctx.prisma.journalEntry.findFirst({
        where: {
          companyId: ctx.targetCompanyId,
          legacyGlNum: headerData.legacyGlNum,
          branchId: headerData.branchId,
          fiscalYearId: headerData.fiscalYearId,
        },
        select: { id: true },
      });
      if (existingTarget) {
        skipped += 1;
        await ctx.idMap.recordMapping({
          jobId: ctx.migrationJobId,
          sourceEntity: 'GLTrxHeader',
          sourceKeyParts: key,
          targetModel: 'JournalEntry',
          targetId: existingTarget.id,
          outcome: 'ALREADY_MAPPED',
          readOnly: true,
        });
        continue;
      }

      const created = await ctx.prisma.$transaction(async (tx) => {
        const entry = await tx.journalEntry.create({
          data: {
            companyId: headerData.companyId,
            branchId: headerData.branchId,
            fiscalYearId: headerData.fiscalYearId,
            legacyGlNum: headerData.legacyGlNum,
            date: headerData.date,
            hijriDate: headerData.hijriDate,
            descriptionAr: headerData.descriptionAr,
            descriptionEn: headerData.descriptionEn,
            description: headerData.description,
            currencyCode: headerData.currencyCode,
            exchangeRate: headerData.exchangeRate.toDecimalPlaces(6).toFixed(6),
            postingStatus: headerData.postingStatus,
            isPosted: headerData.isPosted,
            isBalanced: headerData.isBalanced,
            isCancelled: headerData.isCancelled,
            deletedAt: headerData.deletedAt,
            sourceType: headerData.sourceType,
            sourceNumber: headerData.sourceNumber,
            sourceYearId: headerData.sourceYearId,
            sourceKind: headerData.sourceKind,
            entryType: headerData.entryType,
            workflowStatus: headerData.workflowStatus,
            postedAt: headerData.isPosted ? headerData.date : null,
            postedBy: headerData.isPosted ? 'legacy-historical-import' : null,
            createdBy: headerData.createdBy,
          },
        });
        for (const [lineIdx, line] of detail.entries()) {
          if (lineIdx % 5 === 0) {
            await ctx.throwIfPaused({ stage: STAGE, entity: 'GLTrxDetail' });
          }
          const accountId = accountIds.get(line.accountCode);
          if (!accountId) throw new Error(`Account vanished for ${line.accountCode}`);
          let costCenterId: string | null = null;
          if (line.costCenterCode) {
            const ccMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'CostCenter', {
              companyCode: ctx.legacyCompanyCode,
              code: line.costCenterCode,
            });
            costCenterId = ccMap?.targetId ?? null;
          }
          // Tag party lines so customer / supplier ledgers (partner balances, statements) carry
          // the migrated history, exactly as natively posted documents do.
          const partner = parties ? await parties.partnerForAccount(line.accountCode) : null;
          await tx.journalEntryLine.create({
            data: {
              ...lineWritePayload(line, entry.id, accountId, costCenterId),
              ...(partner ? { partnerId: partner.partnerId, partnerType: partner.partnerType } : {}),
            },
          });
        }
        return entry;
      });

      written += 1;
      await ctx.idMap.recordMapping({
        jobId: ctx.migrationJobId,
        sourceEntity: 'GLTrxHeader',
        sourceKeyParts: key,
        targetModel: 'JournalEntry',
        targetId: created.id,
        outcome: 'CREATED_BY_MIGRATION',
        readOnly: true,
      });
      const glKey = `${yearId}|${branchCode}|${glNum}`;
      await preserveLegacySnapshot(ctx, {
        namespace: IMPORTER_PRESERVE_CONFIG.GLTrxHeader.preserveNamespace,
        sourceKey: glKey,
        raw: header as Record<string, unknown>,
        mappedColumns: IMPORTER_PRESERVE_CONFIG.GLTrxHeader.mappedColumns,
      });
      const rawLines = linesForHeader(header, batch.lines);
      for (const rawLine of rawLines) {
        const detailNum = legacyTrim(rawLine.DetailNum ?? rawLine.IdNum);
        await preserveLegacySnapshot(ctx, {
          namespace: IMPORTER_PRESERVE_CONFIG.GLTrxDetail.preserveNamespace,
          sourceKey: `${glKey}|${detailNum}`,
          raw: rawLine as Record<string, unknown>,
          mappedColumns: IMPORTER_PRESERVE_CONFIG.GLTrxDetail.mappedColumns,
        });
      }
      const failAfter = Number(process.env.MIGRATION_TEST_FAIL_ACCOUNTING_AFTER ?? '');
      if (Number.isFinite(failAfter) && failAfter > 0 && written >= failAfter) {
        lastCompletedCursor = journalCursorKey(header);
        await saveCheckpoint(lastCompletedCursor);
        throw new Error(`MIGRATION_TEST_SIMULATED_FAILURE:ACCOUNTING:${written}`);
      }
      } finally {
        processed += 1n;
        lastCompletedCursor = journalCursorKey(header);
      }
    }

    cursor = batch.nextCursor;
    await saveCheckpoint(lastCompletedCursor);
    if (!batch.nextCursor) {
      await saveCheckpoint('__DONE__');
      break;
    }
  }

  if (!ctx.dryRun) {
    await recordDocumentReturnLinks(ctx);
  }

  return {
    stage: STAGE,
    sourceCounts: {
      postedHeaders: analysis.postedHeaders,
      postedLines: analysis.postedLines,
      skipped,
    },
    transformed: Number(processed),
    written: ctx.dryRun ? 0 : written,
    simulated,
    warnings,
    errors,
    // Open BLOCKER issues stop the job as BLOCKED (same as the treasury stage), never COMPLETED.
    blockers: await ctx.jobs.countOpenBlockers(ctx.migrationJobId),
  };
}

export async function reconcileAccounting(ctx: MigrationContext): Promise<AccountingReconcileResult> {
  const analysis = await analyzeAccounting(ctx);
  const maps = await ctx.prisma.migrationIdMap.findMany({
    where: { migrationJobId: ctx.migrationJobId, targetModel: 'JournalEntry' },
    select: { targetId: true },
  });
  const ids = [...new Set(maps.map((row) => row.targetId))];
  const issues = await ctx.prisma.migrationIssue.findMany({
    where: {
      migrationJobId: ctx.migrationJobId,
      stage: STAGE,
      category: { in: ['QUARANTINE_UNBALANCED', 'QUARANTINE_UNRESOLVED_ACCOUNT', 'QUARANTINE_EMPTY'] },
    },
  });
  const uniqueQuarantineKeys = new Set(
    issues.map((row) => row.sourceKey ?? `${row.category}:${row.id}`)
  );

  let targetDebit = new Decimal(0);
  let targetCredit = new Decimal(0);
  if (ids.length) {
    const grouped = await ctx.prisma.journalEntryLine.groupBy({
      by: ['journalEntryId'],
      where: { journalEntryId: { in: ids } },
      _sum: { debitBase: true, creditBase: true },
    });
    for (const row of grouped) {
      targetDebit = targetDebit.add(money(row._sum.debitBase ?? 0));
      targetCredit = targetCredit.add(money(row._sum.creditBase ?? 0));
    }
  }

  const sourceDebit = money(analysis.sourceDebit);
  const sourceCredit = money(analysis.sourceCredit);
  const difference = targetDebit.sub(sourceDebit).abs().add(targetCredit.sub(sourceCredit).abs());
  const targetLines = ids.length
    ? await ctx.prisma.journalEntryLine.count({ where: { journalEntryId: { in: ids } } })
    : 0;

  return {
    sourceHeaders: analysis.postedHeaders,
    importedHeaders: ids.length,
    skipped: Math.max(0, analysis.postedHeaders - ids.length - uniqueQuarantineKeys.size),
    // Quarantine issues can predate a later successful import of the same journal; only
    // journals still not imported count as quarantined.
    quarantined: Math.min(uniqueQuarantineKeys.size, Math.max(0, analysis.postedHeaders - ids.length)),
    sourcePhysicalLines: analysis.postedLines,
    sourceUniqueLineIdentities: analysis.uniqueLineIdentities,
    zeroValueDuplicatePhysicalRows: analysis.zeroValueDuplicatePhysicalRows,
    targetLines,
    sourceDebit: money2(sourceDebit),
    sourceCredit: money2(sourceCredit),
    targetDebit: money2(targetDebit),
    targetCredit: money2(targetCredit),
    difference: money2(difference),
    openingPolicy: analysis.openingPolicy,
    lineCountExplanation:
      'postedLines is physical EXISTS-filtered GLTrxDetail rows. uniqueLineIdentities collapse duplicate zero-value rows that share Year+Branch+GlNum+DetailNum+Account+amounts. Target keeps physical zeros; they add 0.00 to debit and credit.',
  };
}

async function recordDocumentReturnLinks(ctx: MigrationContext) {
  const links = await loadInvoiceReturnLinks(ctx.source, ctx.legacyCompanyCode);
  for (const row of links) {
    const sourceKey = [
      legacyTrim(row.YearID),
      legacyTrim(row.Type),
      legacyTrim(row.InvoiceNum),
      '->',
      legacyTrim(row.ReturnInvoiceYearID),
      legacyTrim(row.ReturnInvoiceType),
      legacyTrim(row.ReturnInvoiceNum),
    ].join('|');
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      severity: 'INFO',
      category: 'DOCUMENT_RETURN_LINK',
      sourceEntity: 'InvoiceTrxHeader',
      sourceKey,
      description:
        `Source return document ${legacyTrim(row.Type)} ${legacyTrim(row.InvoiceNum)} (GL ${padGlNum(row.GLNum)}) references ${legacyTrim(row.ReturnInvoiceType)} ${legacyTrim(row.ReturnInvoiceNum)} year ${legacyTrim(row.ReturnInvoiceYearID)}. Stored as a document relationship only; reversalOfJournalEntryId is not set and no reversing journal is created.`,
    });
  }
}
