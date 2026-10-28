import type { PrismaClient } from '@prisma/client';
import { buildSourceKey, hashSourceKey } from '../source-key';
import type { MigrationIdOutcome } from '../types';

/** Target id returned for a mapping a dry-run has planned but not written. Never a real row. */
export const DRY_RUN_PLANNED_TARGET_ID = 'dry-run-planned';

/**
 * What a dry-run's earlier stages would have created, per job (in memory only).
 * Later dry-run stages resolve against it instead of reporting every dependency as missing.
 */
const dryRunPlans = new Map<string, Set<string>>();

export class MigrationIdMapService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly opts: { dryRun?: boolean } = {}
  ) {}

  static resetDryRunPlan(jobId: string) {
    dryRunPlans.set(jobId, new Set());
  }

  /** Dry-run only: remember that this source row would be mapped. No database write. */
  planMapping(
    jobId: string,
    sourceEntity: string,
    sourceKeyParts: Record<string, string | number | null | undefined>
  ) {
    if (!this.opts.dryRun) return;
    if (!dryRunPlans.has(jobId)) dryRunPlans.set(jobId, new Set());
    dryRunPlans.get(jobId)!.add(`${sourceEntity}|${hashSourceKey(buildSourceKey(sourceKeyParts))}`);
  }

  async findMapping(
    jobId: string,
    sourceEntity: string,
    sourceKeyParts: Record<string, string | number | null | undefined>
  ) {
    const sourceKey = buildSourceKey(sourceKeyParts);
    const sourceKeyHash = hashSourceKey(sourceKey);
    const row = await this.prisma.migrationIdMap.findUnique({
      where: {
        migrationJobId_sourceEntity_sourceKeyHash: {
          migrationJobId: jobId,
          sourceEntity,
          sourceKeyHash,
        },
      },
    });
    if (row || !this.opts.dryRun) return row;
    if (!dryRunPlans.get(jobId)?.has(`${sourceEntity}|${sourceKeyHash}`)) return null;
    return {
      id: DRY_RUN_PLANNED_TARGET_ID,
      migrationJobId: jobId,
      sourceEntity,
      sourceKey,
      sourceKeyHash,
      targetModel: sourceEntity,
      targetId: DRY_RUN_PLANNED_TARGET_ID,
      outcome: 'PLANNED',
      readOnly: true,
      createdAt: new Date(),
    } as unknown as NonNullable<typeof row>;
  }

  async recordMapping(params: {
    jobId: string;
    sourceEntity: string;
    sourceKeyParts: Record<string, string | number | null | undefined>;
    targetModel: string;
    targetId: string;
    outcome: MigrationIdOutcome;
    readOnly?: boolean;
  }) {
    const sourceKey = buildSourceKey(params.sourceKeyParts);
    const sourceKeyHash = hashSourceKey(sourceKey);
    try {
      return await this.prisma.migrationIdMap.create({
        data: {
          migrationJobId: params.jobId,
          sourceEntity: params.sourceEntity,
          sourceKey,
          sourceKeyHash,
          targetModel: params.targetModel,
          targetId: params.targetId,
          outcome: params.outcome,
          readOnly: params.readOnly ?? false,
        },
      });
    } catch (e: unknown) {
      const existing = await this.prisma.migrationIdMap.findUnique({
        where: {
          migrationJobId_sourceEntity_sourceKeyHash: {
            migrationJobId: params.jobId,
            sourceEntity: params.sourceEntity,
            sourceKeyHash,
          },
        },
      });
      if (existing) return { ...existing, outcome: 'ALREADY_MAPPED' as MigrationIdOutcome };
      throw e;
    }
  }

  async listByJob(jobId: string) {
    return this.prisma.migrationIdMap.findMany({ where: { migrationJobId: jobId } });
  }

  async isMigrationTarget(jobId: string, targetModel: string, targetId: string) {
    const row = await this.prisma.migrationIdMap.findFirst({
      where: { migrationJobId: jobId, targetModel, targetId },
    });
    return Boolean(row);
  }
}
