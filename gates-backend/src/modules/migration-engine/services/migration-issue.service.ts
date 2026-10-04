import type { PrismaClient } from '@prisma/client';
import type { MigrationIssueSeverity } from '../types';

export class MigrationIssueService {
  constructor(private readonly prisma: PrismaClient) {}

  async record(params: {
    jobId: string;
    stage?: string;
    severity: MigrationIssueSeverity;
    category: string;
    sourceEntity?: string;
    sourceKey?: string;
    description: string;
  }) {
    return this.prisma.migrationIssue.create({
      data: {
        migrationJobId: params.jobId,
        stage: params.stage,
        severity: params.severity,
        category: params.category,
        sourceEntity: params.sourceEntity,
        sourceKey: params.sourceKey,
        description: params.description,
      },
    });
  }

  async list(jobId: string) {
    return this.prisma.migrationIssue.findMany({
      where: { migrationJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
