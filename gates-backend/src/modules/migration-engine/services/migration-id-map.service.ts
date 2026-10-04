import type { PrismaClient } from '@prisma/client';
import { buildSourceKey, hashSourceKey } from '../source-key';
import type { MigrationIdOutcome } from '../types';

export class MigrationIdMapService {
  constructor(private readonly prisma: PrismaClient) {}

  async findMapping(
    jobId: string,
    sourceEntity: string,
    sourceKeyParts: Record<string, string | number | null | undefined>
  ) {
    const sourceKey = buildSourceKey(sourceKeyParts);
    const sourceKeyHash = hashSourceKey(sourceKey);
    return this.prisma.migrationIdMap.findUnique({
      where: {
        migrationJobId_sourceEntity_sourceKeyHash: {
          migrationJobId: jobId,
          sourceEntity,
          sourceKeyHash,
        },
      },
    });
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
