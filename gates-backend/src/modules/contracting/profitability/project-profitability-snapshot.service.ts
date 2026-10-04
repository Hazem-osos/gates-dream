import { randomUUID } from 'node:crypto';
import prisma from '../../../shared/database/prisma';
import { ContractingProjectNotFoundError } from '../cost-control/errors/cost-control-domain.errors';
import { projectProfitabilityService } from './project-profitability.service';

export class ProjectProfitabilitySnapshotService {
  async listSnapshots(companyId: string, projectId: string, limit = 50) {
    await this.assertProject(companyId, projectId);
    const rows = await prisma.projectCostForecastSnapshot.findMany({
      where: { companyId, projectId },
      orderBy: { snapshotDate: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      snapshotDate: r.snapshotDate,
      label: r.label,
      revisedContractValue: Number(r.revisedContractValue),
      actualCost: Number(r.actualCost),
      remainingCommitment: Number(r.remainingCommitment),
      uncommittedCostToComplete: Number(r.uncommittedCostToComplete),
      estimateAtCompletion: Number(r.estimateAtCompletion),
      forecastProfit: Number(r.forecastProfit),
      forecastMarginPercent: Number(r.forecastMarginPercent),
      progressPercent: Number(r.progressPercent),
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));
  }

  async createSnapshot(
    companyId: string,
    projectId: string,
    input: { label?: string; snapshotDate?: Date; createdBy?: string }
  ) {
    await this.assertProject(companyId, projectId);
    const summary = await projectProfitabilityService.getProjectSummary(companyId, projectId);
    const row = await prisma.projectCostForecastSnapshot.create({
      data: {
        id: randomUUID(),
        companyId,
        projectId,
        snapshotDate: input.snapshotDate ?? new Date(),
        label: input.label ?? null,
        revisedContractValue: summary.revenue.revisedContractValue,
        actualCost: summary.cost.actualCost,
        remainingCommitment: summary.cost.remainingCommitment,
        uncommittedCostToComplete: summary.cost.uncommittedCostToComplete,
        estimateAtCompletion: summary.cost.estimateAtCompletion,
        forecastProfit: summary.cost.forecastProfit,
        forecastMarginPercent: summary.cost.forecastMarginPercent ?? 0,
        progressPercent: summary.progress.progressPercent,
        createdBy: input.createdBy ?? null,
        payload: summary as object,
      },
    });
    return {
      id: row.id,
      snapshotDate: row.snapshotDate,
      estimateAtCompletion: Number(row.estimateAtCompletion),
      forecastProfit: Number(row.forecastProfit),
    };
  }

  private async assertProject(companyId: string, projectId: string) {
    const p = await prisma.contractingProject.findFirst({ where: { id: projectId, companyId } });
    if (!p) throw new ContractingProjectNotFoundError(companyId, projectId);
  }
}

export const projectProfitabilitySnapshotService = new ProjectProfitabilitySnapshotService();
