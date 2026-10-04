import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { runWithoutTenantScoping } from '../../../shared/database/tenant-context';
import { LegacyGatesSqlServerAdapter } from '../adapters/legacy-gates-sqlserver.adapter';
import { MigrationContext } from '../migration-context';
import { resolveInventorySourcePolicy } from '../policies/inventory-source-policy';
import { assertSafeTargetDatabaseUrl, assertMigrationEngineEnabled } from '../target-safety';
import { canDryRun, canRunExecute } from '../state-machine';
import type { ReconciliationBaseline } from '../types';
import { MigrationCheckpointService } from './migration-checkpoint.service';
import { MigrationIdMapService } from './migration-id-map.service';
import { MigrationIssueService } from './migration-issue.service';
import { MigrationJobService } from './migration-job.service';
import { analyzeFoundation, runFoundationStage } from '../stages/foundation.stage';
import { analyzeCoa, reconcileCoa, runCoaStage } from '../stages/coa.stage';
import {
  analyzeParties,
  reconcileParties,
  runPartiesStage,
  summarizePartiesDryRun,
} from '../stages/parties.stage';
import { buildAccountingSourceCapabilities } from '../accounting-source-profile';
import { rollbackCoa, rollbackFoundation, rollbackParties } from './migration-rollback.service';

const AGRO2_BASELINE: ReconciliationBaseline = {
  postedJournalHeaders: 229,
  baseDebit: '62869333.38',
  baseCredit: '62869333.38',
  difference: '0.00',
  unbalancedPostedJournals: 0,
};

export class MigrationOrchestratorService {
  constructor(private readonly prisma: PrismaClient) {}

  private deps() {
    const jobs = new MigrationJobService(this.prisma);
    const idMap = new MigrationIdMapService(this.prisma);
    const checkpoints = new MigrationCheckpointService(this.prisma);
    const issues = new MigrationIssueService(this.prisma);
    return { jobs, idMap, checkpoints, issues };
  }

  private createAdapter(): LegacyGatesSqlServerAdapter {
    const url =
      process.env.LEGACY_FORENSIC_URL ??
      process.env.LEGACY_MSSQL_URL ??
      process.env.LEGACY_MSSQL_CONNECTION_STRING;
    if (!url) throw new Error('Set LEGACY_FORENSIC_URL for legacy SQL Server adapter.');
    return new LegacyGatesSqlServerAdapter(url);
  }

  async createPilotJob(targetCompanyId: string, legacyCompanyCode = '0001') {
    assertMigrationEngineEnabled();
    assertSafeTargetDatabaseUrl(process.env.DATABASE_URL ?? '');
    const adapter = this.createAdapter();
    await adapter.testConnection();
    const fingerprint = await adapter.getFingerprint(legacyCompanyCode);
    const dbName = await adapter.getDatabaseName();
    await adapter.close();

    const { jobs } = this.deps();
    return jobs.createJob({
      targetCompanyId,
      legacyCompanyCode,
      sourceType: 'LEGACY_GATES_SQLSERVER',
      sourceFingerprint: fingerprint,
      sourceDatabaseName: dbName,
      reconciliationBaseline: AGRO2_BASELINE,
    });
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
      const blockers = await ctx.jobs.countOpenBlockers(jobId);
      await ctx.jobs.transition(jobId, blockers > 0 ? 'BLOCKED' : 'READY_FOR_DRY_RUN');
      await ctx.source.close();
      return { sourceProfile, accountingCapabilities, inventoryPolicy, counts, coaPreview, blockers };
    });
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
      const locked = await ctx.jobs.acquireLock(jobId, token);
      if (!locked) throw new Error(`Job ${jobId} is locked by another runner.`);
      try {
        if (job.status !== 'RUNNING') {
          await ctx.jobs.transition(jobId, 'RUNNING', { dryRun: false, currentStage: 'FOUNDATION' });
        }
        const report = await runFoundationStage(ctx);
        await ctx.jobs.transition(jobId, 'RECONCILING');
        await ctx.jobs.transition(jobId, report.blockers > 0 ? 'BLOCKED' : 'COMPLETED');
        return report;
      } catch (err) {
        await ctx.jobs.transition(jobId, 'FAILED').catch(() => undefined);
        throw err;
      } finally {
        await ctx.jobs.releaseLock(jobId, token);
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
      const locked = await ctx.jobs.acquireLock(jobId, token);
      if (!locked) throw new Error(`Job ${jobId} is locked by another runner.`);
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
        await ctx.jobs.transition(jobId, 'FAILED').catch(() => undefined);
        throw err;
      } finally {
        await ctx.jobs.releaseLock(jobId, token);
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
      const locked = await ctx.jobs.acquireLock(jobId, token);
      if (!locked) throw new Error(`Job ${jobId} is locked by another runner.`);
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
        await ctx.jobs.transition(jobId, 'FAILED').catch(() => undefined);
        throw err;
      } finally {
        await ctx.jobs.releaseLock(jobId, token);
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

  async rollback(jobId: string) {
    const parties = await rollbackParties(this.prisma, jobId);
    const coa = await rollbackCoa(this.prisma, jobId);
    const foundation = await rollbackFoundation(this.prisma, jobId);
    return { parties, coa, foundation };
  }

  private async withJob<T>(
    jobId: string,
    fn: (ctx: MigrationContext, job: NonNullable<Awaited<ReturnType<MigrationJobService['getJob']>>>) => Promise<T>,
    dryRunFlag = false
  ): Promise<T> {
    assertMigrationEngineEnabled();
    assertSafeTargetDatabaseUrl(process.env.DATABASE_URL ?? '');
    return runWithoutTenantScoping(async () => {
      const { jobs, idMap, checkpoints, issues } = this.deps();
      const job = await jobs.getJob(jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);
      const adapter = this.createAdapter();
      const fingerprint = await adapter.getFingerprint(job.legacyCompanyCode);
      await jobs.assertFingerprint(jobId, fingerprint);
      const ctx = new MigrationContext(
        {
          migrationJobId: jobId,
          targetCompanyId: job.targetCompanyId,
          legacyCompanyCode: job.legacyCompanyCode,
          sourceFingerprint: fingerprint,
          dryRun: dryRunFlag,
          options: { legacyCompanyCode: job.legacyCompanyCode, batchSize: 200 },
        },
        { prisma: this.prisma, jobService: jobs, idMapService: idMap, checkpointService: checkpoints, issueService: issues, sourceAdapter: adapter }
      );
      return fn(ctx, job);
    });
  }
}
