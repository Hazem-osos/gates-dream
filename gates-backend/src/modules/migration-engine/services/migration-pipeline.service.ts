import type { PrismaClient } from '@prisma/client';
import { MigrationOrchestratorService } from './migration-orchestrator.service';
import { MigrationJobService } from './migration-job.service';
import { MigrationIdMapService } from './migration-id-map.service';
import { refreshLedgerCachesAfterMigration } from './migration-ledger-cache.service';

export type MigrationPipelineMode = 'dry-run' | 'execute';

export type MigrationPipelineStageId =
  | 'FOUNDATION'
  | 'COA'
  | 'PARTIES'
  | 'ACCOUNTING'
  | 'ITEMS'
  | 'INVENTORY'
  | 'COMMERCIAL'
  | 'TREASURY_HISTORICAL'
  | 'SETTLEMENT_HISTORICAL'
  | 'CHEQUE_HISTORICAL';

const STAGES: MigrationPipelineStageId[] = [
  'FOUNDATION',
  'COA',
  'PARTIES',
  'ACCOUNTING',
  'ITEMS',
  'INVENTORY',
  'COMMERCIAL',
  'TREASURY_HISTORICAL',
  'SETTLEMENT_HISTORICAL',
  'CHEQUE_HISTORICAL',
];

export class MigrationPipelineService {
  private readonly orchestrator: MigrationOrchestratorService;
  private readonly jobs: MigrationJobService;

  constructor(private readonly prisma: PrismaClient) {
    this.orchestrator = new MigrationOrchestratorService(prisma);
    this.jobs = new MigrationJobService(prisma);
  }

  async runPipeline(jobId: string, mode: MigrationPipelineMode, stages?: MigrationPipelineStageId[]) {
    const order = stages?.length ? stages.filter((s) => STAGES.includes(s)) : STAGES;
    const results: Record<string, unknown> = {};
    if (mode === 'dry-run') MigrationIdMapService.resetDryRunPlan(jobId);

    await this.jobs.mergeProgress(jobId, {
      pipeline: { mode, stages: order, startedAt: new Date().toISOString() },
    });

    for (const stage of order) {
      if (mode === 'execute' && stage === 'COMMERCIAL') {
        const job = await this.jobs.getJob(jobId);
        if (job) {
          const operationalBaselineCount = await this.prisma.journalEntry.count({
            where: { companyId: job.targetCompanyId },
          });
          await this.jobs.mergeProgress(jobId, {
            journalIntegrity: {
              operationalBaselineCount,
              operationalBaselineAt: new Date().toISOString(),
            },
          });
        }
      }
      await this.jobs.mergeProgress(jobId, { pipeline: { currentStage: stage } });
      if (mode === 'dry-run') {
        results[stage] = await this.dryRunStage(jobId, stage);
      } else {
        results[stage] = await this.executeStage(jobId, stage);
      }
      const job = await this.jobs.getJob(jobId);
      if (job?.status === 'BLOCKED' || job?.status === 'FAILED' || job?.status === 'PAUSED') {
        break;
      }
    }

    const finalJob = await this.jobs.getJob(jobId);
    const terminal =
      finalJob &&
      ['PAUSED', 'FAILED', 'BLOCKED'].includes(finalJob.status);

    if (!terminal) {
      await this.jobs.mergeProgress(jobId, {
        pipeline: { finishedAt: new Date().toISOString(), resultsSummary: Object.keys(results) },
        lifecycle: {
          phase: mode === 'dry-run' ? 'DRY_RUN' : 'MIGRATED',
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      await this.jobs.mergeProgress(jobId, {
        pipeline: {
          finishedAt: new Date().toISOString(),
          resultsSummary: Object.keys(results),
          aborted: true,
          status: finalJob?.status,
        },
      });
    }

    if (mode === 'execute' && !terminal && finalJob?.status !== 'PAUSED') {
      // Imported journals bypass the posting service: rebuild the ledger caches from the GL
      // before reconciling, so reports and party cards show the migrated history.
      const ledgerCaches = await refreshLedgerCachesAfterMigration(this.prisma, jobId, finalJob!.targetCompanyId);
      await this.jobs.mergeProgress(jobId, { ledgerCaches: { ...ledgerCaches, refreshedAt: new Date().toISOString() } });
      const bundle = await this.orchestrator.runFullReconciliation(jobId);
      const afterReconcile = await this.jobs.getJob(jobId);
      if (afterReconcile?.status === 'COMPLETED') {
        return { stages: results, reconciliation: bundle };
      }
      return { stages: results, reconciliation: bundle, incomplete: true };
    }

    return results;
  }

  private async dryRunStage(jobId: string, stage: MigrationPipelineStageId) {
    switch (stage) {
      case 'FOUNDATION':
        return this.orchestrator.dryRun(jobId);
      case 'COA':
        return this.orchestrator.dryRunCoa(jobId);
      case 'PARTIES':
        return this.orchestrator.dryRunParties(jobId);
      case 'ACCOUNTING':
        return this.orchestrator.dryRunAccounting(jobId);
      case 'ITEMS':
        return this.orchestrator.dryRunItems(jobId);
      case 'INVENTORY':
        return this.orchestrator.dryRunInventory(jobId);
      case 'COMMERCIAL':
        return this.orchestrator.dryRunCommercial(jobId);
      case 'TREASURY_HISTORICAL':
        return this.orchestrator.dryRunTreasuryHistorical(jobId);
      case 'SETTLEMENT_HISTORICAL':
        return this.orchestrator.dryRunSettlementHistorical(jobId);
      case 'CHEQUE_HISTORICAL':
        return this.orchestrator.dryRunChequeHistorical(jobId);
      default:
        throw new Error(`Unknown stage ${stage}`);
    }
  }

  private async executeStage(jobId: string, stage: MigrationPipelineStageId) {
    switch (stage) {
      case 'FOUNDATION':
        return this.orchestrator.runFoundation(jobId);
      case 'COA':
        return this.orchestrator.runCoa(jobId);
      case 'PARTIES':
        return this.orchestrator.runParties(jobId);
      case 'ACCOUNTING':
        return this.orchestrator.runAccounting(jobId);
      case 'ITEMS':
        return this.orchestrator.runItems(jobId);
      case 'INVENTORY':
        return this.orchestrator.runInventory(jobId);
      case 'COMMERCIAL':
        return this.orchestrator.runCommercial(jobId);
      case 'TREASURY_HISTORICAL':
        return this.orchestrator.runTreasuryHistorical(jobId);
      case 'SETTLEMENT_HISTORICAL':
        return this.orchestrator.runSettlementHistorical(jobId);
      case 'CHEQUE_HISTORICAL':
        return this.orchestrator.runChequeHistorical(jobId);
      default:
        throw new Error(`Unknown stage ${stage}`);
    }
  }

  async analyze(jobId: string) {
    return this.orchestrator.analyze(jobId);
  }
}
