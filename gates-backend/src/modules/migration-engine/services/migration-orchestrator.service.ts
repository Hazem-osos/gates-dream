import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { runWithoutTenantScoping } from '../../../shared/database/tenant-context';
import { resolveLegacySourceAdapterForJob } from '../legacy-source/legacy-source.factory';
import { LegacySourceConfigService } from '../legacy-source/legacy-source-config.service';
import type { LegacySourceAdapter } from '../types';
import { MigrationContext } from '../migration-context';
import { resolveInventorySourcePolicy } from '../policies/inventory-source-policy';
import { assertSafeTargetDatabaseUrl, assertMigrationEngineEnabled } from '../target-safety';
import { resolveMigrationBatchSize } from '../migration-engine-config';
import { canDryRun, canRunExecute } from '../state-machine';
import type { ReconciliationBaseline } from '../types';
import { MigrationCheckpointService } from './migration-checkpoint.service';
import { runMigrationPreflight } from './migration-preflight.service';
import { rebuildCompanyBalances } from '../../accounting/services/ledger-balance.service';
import { MigrationIdMapService } from './migration-id-map.service';
import { MigrationIssueService } from './migration-issue.service';
import { MigrationJobService } from './migration-job.service';
import { analyzeFoundation, runFoundationStage } from '../stages/foundation.stage';
import { analyzeCoa, reconcileCoa, runCoaStage } from '../stages/coa.stage';
import {
  analyzeAccounting,
  reconcileAccounting,
  runAccountingStage,
} from '../stages/accounting.stage';
import { analyzeItems, runItemsStage } from '../stages/items.stage';
import {
  analyzeInventory,
  reconcileInventory,
  runInventoryStage,
} from '../stages/inventory.stage';
import { analyzeCommercial, runCommercialStage } from '../stages/commercial.stage';
import {
  analyzeTreasuryHistorical,
  runTreasuryHistoricalStage,
} from '../stages/treasury-historical.stage';
import {
  analyzeSettlementHistorical,
  runSettlementHistoricalStage,
} from '../stages/settlement-historical.stage';
import {
  analyzeChequeHistorical,
  runChequeHistoricalStage,
} from '../stages/cheque-historical.stage';
import {
  analyzeParties,
  reconcileParties,
  runPartiesStage,
  summarizePartiesDryRun,
} from '../stages/parties.stage';
import { buildAccountingSourceCapabilities } from '../accounting-source-profile';
import {
  rollbackAccounting,
  rollbackCoa,
  rollbackFoundation,
  rollbackInventory,
  rollbackItems,
  rollbackParties,
  rollbackCommercial,
  rollbackTreasuryHistorical,
  rollbackSettlementHistorical,
  rollbackChequeHistorical,
} from './migration-rollback.service';
import { analyzeOperationalReadiness } from './migration-operational-readiness.service';
import { buildCoreCoverageMatrix } from './migration-core-coverage.service';
import {
  runReconciliationBundle,
  type MigrationReconciliationBundle,
} from './migration-reconciliation-bundle.service';
import { handleMigrationStageError } from '../migration-cooperative-pause';
import { countPostedJournalHeaders, loadPostedJournalTotals } from './legacy-journal-data.service';
import { LEGACY_POSTED_GL_HEADER_WHERE } from '../coa/legacy-posted-gl';
import { money } from '../accounting/journal-money';

/**
 * Measures the posted-GL baseline of THIS source (count, base debit/credit, unbalanced
 * posted vouchers). Previously every job was stamped with a hard-coded snapshot of the
 * pilot customer's books, whatever source it connected to. Returns undefined when the
 * source cannot be measured — never a borrowed figure.
 */
async function measureReconciliationBaseline(
  adapter: LegacySourceAdapter,
  legacyCompanyCode: string
): Promise<ReconciliationBaseline | undefined> {
  try {
    const totals = await loadPostedJournalTotals(adapter, legacyCompanyCode);
    const postedJournalHeaders = await countPostedJournalHeaders(adapter, legacyCompanyCode);
    const unbalanced = await adapter.querySql<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM dbo.GLTrxHeader h
       WHERE RTRIM(h.CompanyCode)=@cc AND ${LEGACY_POSTED_GL_HEADER_WHERE}
         AND RTRIM(ISNULL(h.Balanced,''))='F'`,
      { cc: legacyCompanyCode }
    );
    return {
      postedJournalHeaders,
      baseDebit: totals.debit,
      baseCredit: totals.credit,
      difference: money(totals.debit).minus(money(totals.credit)).toFixed(2),
      unbalancedPostedJournals: Number(unbalanced[0]?.cnt ?? 0),
    };
  } catch {
    return undefined;
  }
}

export class MigrationOrchestratorService {
  constructor(private readonly prisma: PrismaClient) {}

  private deps(dryRun = false) {
    const jobs = new MigrationJobService(this.prisma);
    const idMap = new MigrationIdMapService(this.prisma, { dryRun });
    const checkpoints = new MigrationCheckpointService(this.prisma);
    const issues = new MigrationIssueService(this.prisma);
    return { jobs, idMap, checkpoints, issues };
  }

  private async createAdapterForJob(
    job: NonNullable<Awaited<ReturnType<MigrationJobService['getJob']>>>
  ): Promise<LegacySourceAdapter> {
    return resolveLegacySourceAdapterForJob(this.prisma, job);
  }

  async createPilotJob(
    targetCompanyId: string,
    legacyCompanyCode = '0001',
    opts?: {
      sourceMode?: string;
      legacySourceConfigId?: string;
      provisionalFingerprint?: string;
      skipSourceProbe?: boolean;
    }
  ) {
    assertMigrationEngineEnabled();
    assertSafeTargetDatabaseUrl(process.env.DATABASE_URL ?? '');
    const { jobs } = this.deps();
    const mode = opts?.sourceMode ?? 'REMOTE_SQL_SERVER';

    if (opts?.skipSourceProbe && opts.provisionalFingerprint) {
      return jobs.createJob({
        targetCompanyId,
        legacyCompanyCode,
        sourceType: 'LEGACY_GATES_SQLSERVER',
        sourceMode: mode,
        sourceFingerprint: opts.provisionalFingerprint,
        legacySourceConfigId: opts.legacySourceConfigId,
      });
    }

    const draft = await jobs.createJob({
      targetCompanyId,
      legacyCompanyCode,
      sourceType: 'LEGACY_GATES_SQLSERVER',
      sourceMode: mode,
      sourceFingerprint: 'pending',
      legacySourceConfigId: opts?.legacySourceConfigId,
      legacyConnectionRef:
        mode === 'REMOTE_SQL_SERVER' && !opts?.legacySourceConfigId
          ? 'LEGACY_FORENSIC_URL'
          : undefined,
    });

    const adapter = await this.createAdapterForJob(draft);
    await adapter.testConnection();
    const fingerprint = await adapter.getFingerprint(legacyCompanyCode);
    const dbName = await adapter.getDatabaseName();
    const baseline = await measureReconciliationBaseline(adapter, legacyCompanyCode);
    await adapter.close();

    return this.prisma.migrationJob.update({
      where: { id: draft.id },
      data: {
        sourceFingerprint: fingerprint,
        sourceDatabaseName: dbName,
        ...(baseline ? { reconciliationBaseline: baseline as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async probeAndBindRemoteConfig(companyId: string, legacyCompanyCode: string) {
    const configSvc = new LegacySourceConfigService(this.prisma);
    return configSvc.testRemoteConnection(companyId, legacyCompanyCode);
  }

  async analyze(jobId: string) {
    return this.withJob(jobId, async (ctx) => {
      await ctx.jobs.transition(jobId, 'ANALYZING');
      const inventoryPolicy = await resolveInventorySourcePolicy(ctx.source, ctx.legacyCompanyCode);
      const sourceProfile = inventoryPolicy.profile;
      const accountingCapabilities = await buildAccountingSourceCapabilities(
        ctx.source,
        ctx.legacyCompanyCode
      );
      const counts = await analyzeFoundation(ctx);
      const coaPreview = await analyzeCoa(ctx);
      const operationalReadiness = await analyzeOperationalReadiness(ctx);
      const coreCoverage = await buildCoreCoverageMatrix(ctx);
      const { buildSchemaCoverageReport } = await import('./migration-legacy-schema-coverage.service');
      const { buildMachineReadableFieldReport } = await import('./migration-field-evidence.service');
      let schemaCoverage: ReturnType<typeof buildSchemaCoverageReport> | null = null;
      let fieldEvidenceReport: ReturnType<typeof buildMachineReadableFieldReport> | null = null;
      try {
        schemaCoverage = buildSchemaCoverageReport();
        fieldEvidenceReport = buildMachineReadableFieldReport();
      } catch (err) {
        await ctx.issues.recordOnce({
          jobId,
          severity: 'WARNING',
          category: 'SCHEMA_COVERAGE_PARSE_FAILED',
          description: err instanceof Error ? err.message : String(err),
        });
      }
      // Pre-import checklist: what to add / fix / ignore in the legacy data (Arabic, per check).
      const preflight = await runMigrationPreflight(ctx);
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      await ctx.jobs.transition(jobId, blockers > 0 ? 'BLOCKED' : 'READY_FOR_DRY_RUN');
      await ctx.jobs.mergeProgress(jobId, {
        lifecycle: { phase: 'ANALYZED', updatedAt: new Date().toISOString() },
        coreCoverage: { ...coreCoverage, schemaCoverage, fieldEvidenceReport },
        preflight: { checkedAt: new Date().toISOString(), findings: preflight },
      });
      await ctx.source.close();
      return {
        sourceProfile,
        accountingCapabilities,
        inventoryPolicy,
        counts,
        coaPreview,
        operationalReadiness,
        coreCoverage,
        preflight,
        blockers,
      };
    });
  }

  async runFullReconciliation(jobId: string): Promise<MigrationReconciliationBundle> {
    return this.withJob(jobId, async (ctx) => {
      await ctx.jobs.transition(jobId, 'RECONCILING');
      const openBlockers = await ctx.jobs.countOpenBlockers(jobId);
      const bundle = await runReconciliationBundle(ctx, openBlockers);
      await ctx.jobs.mergeProgress(jobId, {
        reconciliation: bundle,
        lifecycle: {
          phase: bundle.summary.materialPass ? 'RECONCILED' : 'MIGRATED',
          reconciliationPass: bundle.summary.materialPass,
          updatedAt: new Date().toISOString(),
        },
      });
      await ctx.jobs.transition(jobId, bundle.summary.materialPass ? 'COMPLETED' : 'BLOCKED');
      await ctx.source.close();
      return bundle;
    }, false);
  }

  async dryRun(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot dry-run in status ${job.status} (blockers=${blockers})`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'FOUNDATION' });
      const report = await runFoundationStage(ctx);
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return report;
    }, true);
  }

  async runFoundation(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'FOUNDATION' });
        }
        const report = await runFoundationStage(ctx);
        await ctx.jobs.transition(jobId, 'RECONCILING');
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        return report;
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async dryRunCoa(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot COA dry-run in status ${job.status}`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'COA' });
      const before = await ctx.prisma.account.count({ where: { companyId: ctx.targetCompanyId } });
      const report = await runCoaStage(ctx);
      const after = await ctx.prisma.account.count({ where: { companyId: ctx.targetCompanyId } });
      report.sourceCounts.accountRowDelta = after - before;
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return report;
    }, true);
  }

  async runCoa(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run COA in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'COA' });
        }
        const report = await runCoaStage(ctx);
        const reconcile = await reconcileCoa(ctx);
        await ctx.jobs.transition(jobId, 'RECONCILING');
        // COA stage completes when accounts are imported; GL ambiguous codes are a readiness gate, not a job blocker.
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        await ctx.source.close();
        return { report, reconcile };
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async reconcileCoaJob(jobId: string) {
    return this.withJob(jobId, async (ctx) => {
      const result = await reconcileCoa(ctx);
      await ctx.source.close();
      return result;
    }, false);
  }

  async dryRunParties(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot parties dry-run in status ${job.status}`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'PARTIES' });
      const beforeCust = await ctx.prisma.customer.count({ where: { companyId: ctx.targetCompanyId } });
      const beforeSup = await ctx.prisma.supplier.count({ where: { companyId: ctx.targetCompanyId } });
      const analysis = await analyzeParties(ctx);
      const report = await runPartiesStage(ctx);
      const afterCust = await ctx.prisma.customer.count({ where: { companyId: ctx.targetCompanyId } });
      const afterSup = await ctx.prisma.supplier.count({ where: { companyId: ctx.targetCompanyId } });
      const delta = afterCust + afterSup - (beforeCust + beforeSup);
      const summary = summarizePartiesDryRun(
        analysis.classification,
        analysis.profile.customerRowCount,
        analysis.profile.supplierRowCount,
        delta
      );
      report.sourceCounts.targetRowDelta = delta;
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return { report, summary, classification: analysis.classification };
    }, true);
  }

  async runParties(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run parties in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'PARTIES' });
        }
        const report = await runPartiesStage(ctx);
        const reconcile = await reconcileParties(ctx);
        await ctx.jobs.transition(jobId, 'RECONCILING');
        await ctx.jobs.transition(jobId, 'COMPLETED');
        await ctx.source.close();
        return { report, reconcile };
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async reconcilePartiesJob(jobId: string) {
    return this.withJob(jobId, async (ctx) => {
      const result = await reconcileParties(ctx);
      await ctx.source.close();
      return result;
    }, false);
  }

  async dryRunAccounting(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot accounting dry-run in status ${job.status}`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'ACCOUNTING' });
      const before = await ctx.prisma.journalEntry.count({ where: { companyId: ctx.targetCompanyId } });
      const analysis = await analyzeAccounting(ctx);
      const report = await runAccountingStage(ctx);
      const after = await ctx.prisma.journalEntry.count({ where: { companyId: ctx.targetCompanyId } });
      report.sourceCounts.journalRowDelta = after - before;
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return { report, analysis };
    }, true);
  }

  async runAccounting(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run accounting in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'ACCOUNTING' });
        }
        const report = await runAccountingStage(ctx);
        const reconcile = await reconcileAccounting(ctx);
        await ctx.jobs.transition(jobId, 'RECONCILING');
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        await ctx.source.close();
        return { report, reconcile };
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async reconcileAccountingJob(jobId: string) {
    return this.withJob(jobId, async (ctx) => {
      const result = await reconcileAccounting(ctx);
      await ctx.source.close();
      return result;
    }, false);
  }

  async dryRunItems(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot items dry-run in status ${job.status}`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'ITEMS' });
      const before = await ctx.prisma.item.count({ where: { companyId: ctx.targetCompanyId } });
      const analysis = await analyzeItems(ctx);
      const report = await runItemsStage(ctx);
      const after = await ctx.prisma.item.count({ where: { companyId: ctx.targetCompanyId } });
      report.sourceCounts.itemRowDelta = after - before;
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return { report, analysis };
    }, true);
  }

  async runItems(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run items in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'ITEMS' });
        }
        const report = await runItemsStage(ctx);
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        await ctx.source.close();
        return { report };
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async dryRunInventory(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot inventory dry-run in status ${job.status}`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'INVENTORY' });
      const before = await ctx.prisma.inventoryMovement.count({ where: { companyId: ctx.targetCompanyId } });
      const beforeJournals = await ctx.prisma.journalEntry.count({ where: { companyId: ctx.targetCompanyId } });
      const analysis = await analyzeInventory(ctx);
      const report = await runInventoryStage(ctx);
      const after = await ctx.prisma.inventoryMovement.count({ where: { companyId: ctx.targetCompanyId } });
      const afterJournals = await ctx.prisma.journalEntry.count({ where: { companyId: ctx.targetCompanyId } });
      report.sourceCounts.movementRowDelta = after - before;
      report.sourceCounts.journalRowDelta = afterJournals - beforeJournals;
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return { report, analysis };
    }, true);
  }

  async runInventory(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run inventory in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'INVENTORY' });
        }
        const report = await runInventoryStage(ctx);
        const reconcile = await reconcileInventory(ctx);
        await ctx.jobs.transition(jobId, 'RECONCILING');
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        await ctx.source.close();
        return { report, reconcile };
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async reconcileInventoryJob(jobId: string) {
    return this.withJob(jobId, async (ctx) => {
      const result = await reconcileInventory(ctx);
      await ctx.source.close();
      return result;
    }, false);
  }

  async dryRunCommercial(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot commercial dry-run in status ${job.status}`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'COMMERCIAL' });
      const analysis = await analyzeCommercial(ctx);
      const report = await runCommercialStage(ctx);
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return { report, analysis };
    }, true);
  }

  async runCommercial(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run commercial in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'COMMERCIAL' });
        }
        const report = await runCommercialStage(ctx);
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        await ctx.source.close();
        return { report };
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async dryRunTreasuryHistorical(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot treasury dry-run in status ${job.status}`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'TREASURY_HISTORICAL' });
      const analysis = await analyzeTreasuryHistorical(ctx);
      const report = await runTreasuryHistoricalStage(ctx);
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return { report, analysis };
    }, true);
  }

  async runTreasuryHistorical(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run treasury historical in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'TREASURY_HISTORICAL' });
        }
        const report = await runTreasuryHistoricalStage(ctx);
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        await ctx.source.close();
        return { report };
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async dryRunSettlementHistorical(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot settlement dry-run in status ${job.status}`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'SETTLEMENT_HISTORICAL' });
      const analysis = await analyzeSettlementHistorical(ctx);
      const report = await runSettlementHistoricalStage(ctx);
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return { report, analysis };
    }, true);
  }

  async runSettlementHistorical(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run settlement historical in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'SETTLEMENT_HISTORICAL' });
        }
        const report = await runSettlementHistoricalStage(ctx);
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        await ctx.source.close();
        return { report };
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async dryRunChequeHistorical(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canDryRun(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot cheque dry-run in status ${job.status}`);
      }
      await ctx.jobs.transition(jobId, 'DRY_RUNNING', { dryRun: true, currentStage: 'CHEQUE_HISTORICAL' });
      const analysis = await analyzeChequeHistorical(ctx);
      const report = await runChequeHistoricalStage(ctx);
      await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'READY', { dryRun: true });
      await ctx.source.close();
      return { report, analysis };
    }, true);
  }

  async runChequeHistorical(jobId: string) {
    return this.withJob(jobId, async (ctx, job) => {
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      if (!canRunExecute(job.status as any, blockers)) {
        throw new Error(`Job ${jobId} cannot run cheque historical in status ${job.status}`);
      }
      const token = randomUUID();
      const lock = await ctx.jobs.acquireLockOrReuse(jobId, token);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'CHEQUE_HISTORICAL' });
        }
        const beforeJournals = await ctx.prisma.journalEntry.count({ where: { companyId: ctx.targetCompanyId } });
        const report = await runChequeHistoricalStage(ctx);
        const afterJournals = await ctx.prisma.journalEntry.count({ where: { companyId: ctx.targetCompanyId } });
        report.sourceCounts.journalRowDelta = afterJournals - beforeJournals;
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        await ctx.source.close();
        return { report };
      } catch (err) {
        await handleMigrationStageError(ctx.jobs, jobId, err);
        throw err;
      } finally {
        if (lock === 'acquired') await ctx.jobs.releaseLock(jobId, token);
        await ctx.source.close();
      }
    }, false);
  }

  async rollback(jobId: string) {
    const settlement = await rollbackSettlementHistorical(this.prisma, jobId);
    const cheques = await rollbackChequeHistorical(this.prisma, jobId);
    const treasury = await rollbackTreasuryHistorical(this.prisma, jobId);
    const commercial = await rollbackCommercial(this.prisma, jobId);
    const inventory = await rollbackInventory(this.prisma, jobId);
    const items = await rollbackItems(this.prisma, jobId);
    const accounting = await rollbackAccounting(this.prisma, jobId);
    // Caches were rebuilt after import and reference migrated accounts: rebuild them from the
    // remaining GL before the accounts and parties are removed.
    const job = await this.prisma.migrationJob.findUnique({ where: { id: jobId }, select: { targetCompanyId: true } });
    if (job) {
      await this.prisma.$transaction((tx) => rebuildCompanyBalances(tx, job.targetCompanyId), {
        maxWait: 30_000,
        timeout: 15 * 60_000,
      });
    }
    const parties = await rollbackParties(this.prisma, jobId);
    const coa = await rollbackCoa(this.prisma, jobId);
    const foundation = await rollbackFoundation(this.prisma, jobId);
    return { settlement, cheques, treasury, commercial, inventory, items, accounting, parties, coa, foundation };
  }

  private async withJob<T>(
    jobId: string,
    fn: (ctx: MigrationContext, job: NonNullable<Awaited<ReturnType<MigrationJobService['getJob']>>>) => Promise<T>,
    dryRunFlag = false
  ): Promise<T> {
    assertMigrationEngineEnabled();
    assertSafeTargetDatabaseUrl(process.env.DATABASE_URL ?? '');
    return runWithoutTenantScoping(async () => {
      const { jobs, idMap, checkpoints, issues } = this.deps(dryRunFlag);
      const job = await jobs.getJob(jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);
      const adapter = await this.createAdapterForJob(job);
      const fingerprint = await adapter.getFingerprint(job.legacyCompanyCode);
      await jobs.assertFingerprint(jobId, fingerprint);
      const ctx = new MigrationContext(
        {
          migrationJobId: jobId,
          targetCompanyId: job.targetCompanyId,
          legacyCompanyCode: job.legacyCompanyCode,
          sourceFingerprint: fingerprint,
          dryRun: dryRunFlag,
          options: {
            legacyCompanyCode: job.legacyCompanyCode,
            batchSize: resolveMigrationBatchSize(),
          },
        },
        { prisma: this.prisma, jobService: jobs, idMapService: idMap, checkpointService: checkpoints, issueService: issues, sourceAdapter: adapter }
      );
      return fn(ctx, job);
    });
  }
}
