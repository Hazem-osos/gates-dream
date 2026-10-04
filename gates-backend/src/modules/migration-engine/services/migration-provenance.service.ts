import type { PrismaClient } from '@prisma/client';

/**
 * Migration-engine internal registry helpers (id map / job provenance).
 * Not wired into normal ERP operational services.
 */
export class MigrationProvenanceService {
  constructor(private readonly prisma: PrismaClient) {}

  async listReadOnlyTargets(jobId: string, targetModel: string) {
    return this.prisma.migrationIdMap.findMany({
      where: { migrationJobId: jobId, targetModel, readOnly: true },
      select: { targetId: true, sourceEntity: true, sourceKey: true },
    });
  }

  async wasCreatedByJob(jobId: string, targetModel: string, targetId: string) {
    const row = await this.prisma.migrationIdMap.findFirst({
      where: { migrationJobId: jobId, targetModel, targetId },
    });
    return row?.outcome === 'CREATED_BY_MIGRATION';
  }
}
