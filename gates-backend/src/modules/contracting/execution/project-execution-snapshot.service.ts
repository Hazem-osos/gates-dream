import { randomUUID } from 'node:crypto';
import prisma from '../../../shared/database/prisma';
import { money, rate } from '../utils/money-decimal';
import { projectExecutionPerformanceService } from './project-execution-performance.service';

export class ProjectExecutionSnapshotService {
  async listSnapshots(companyId: string, projectId: string) {
    return prisma.projectExecutionPerformanceSnapshot.findMany({
      where: { companyId, projectId },
      orderBy: { snapshotDate: 'desc' },
      take: 60,
    });
  }

  async createSnapshot(
    companyId: string,
    projectId: string,
    input?: { label?: string; asOfDate?: Date; createdBy?: string }
  ) {
    const asOf = input?.asOfDate ?? new Date();
    const summary = await projectExecutionPerformanceService.getPerformanceSummary(companyId, projectId, {
      asOfDate: asOf,
    });
    return prisma.projectExecutionPerformanceSnapshot.create({
      data: {
        id: randomUUID(),
        companyId,
        projectId,
        snapshotDate: asOf,
        label: input?.label ?? null,
        plannedProgressPercent: money(summary.progress.plannedPercent),
        actualProgressPercent: money(summary.progress.actualPercent),
        pv: money(summary.evm.pv),
        ev: money(summary.evm.ev),
        ac: money(summary.evm.ac),
        cpi: summary.evm.cpi != null ? rate(summary.evm.cpi) : null,
        spi: summary.evm.spi != null ? rate(summary.evm.spi) : null,
        payload: summary as unknown as object,
        createdBy: input?.createdBy ?? null,
      },
    });
  }
}

export const projectExecutionSnapshotService = new ProjectExecutionSnapshotService();
