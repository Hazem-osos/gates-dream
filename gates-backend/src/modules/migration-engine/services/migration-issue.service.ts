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

  async recordOnce(params: {
    jobId: string;
    stage?: string;
    severity: MigrationIssueSeverity;
    category: string;
    sourceEntity?: string;
    sourceKey?: string;
    description: string;
  }) {
    const existing = await this.prisma.migrationIssue.findFirst({
      where: {
        migrationJobId: params.jobId,
        category: params.category,
        sourceKey: params.sourceKey ?? null,
      },
      select: { id: true },
    });
    if (existing) return existing;
    return this.record(params);
  }

  async list(jobId: string) {
    return this.prisma.migrationIssue.findMany({
      where: { migrationJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listPaginated(jobId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { migrationJobId: jobId };
    const [items, total] = await Promise.all([
      this.prisma.migrationIssue.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.migrationIssue.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
