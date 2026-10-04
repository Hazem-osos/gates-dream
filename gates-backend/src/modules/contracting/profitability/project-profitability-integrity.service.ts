import prisma from '../../../shared/database/prisma';
import { projectCostQueryService } from '../project-cost/project-cost-query.service';
import { projectProfitabilityService } from './project-profitability.service';

export type ProfitabilityIntegrityStatus =
  | 'MATCH'
  | 'ACTUAL_COST_MISMATCH'
  | 'REVISED_CONTRACT_MISMATCH'
  | 'CERTIFIED_REVENUE_MISMATCH'
  | 'COLLECTION_MISMATCH'
  | 'COMMITMENT_UNDER_ACTUAL'
  | 'BOQ_PROJECT_TOTAL_MISMATCH'
  | 'SNAPSHOT_INCONSISTENT';

export type ProfitabilityIntegrityRow = {
  status: ProfitabilityIntegrityStatus;
  reason: string;
  expected?: number | string | null;
  actual?: number | string | null;
};

export class ProjectProfitabilityIntegrityService {
  async reconcileProject(companyId: string, projectId: string) {
    const [summary, p21Actual, boq] = await Promise.all([
      projectProfitabilityService.getProjectSummary(companyId, projectId),
      projectCostQueryService.getProjectSummary(companyId, projectId),
      projectProfitabilityService.getBoqBreakdown(companyId, projectId),
    ]);

    const rows: ProfitabilityIntegrityRow[] = [];

    if (Math.abs(summary.cost.actualCost - p21Actual.totals.totalActualCost) > 0.02) {
      rows.push({
        status: 'ACTUAL_COST_MISMATCH',
        reason: 'P2-2 actualCost must equal P2-1 ProjectCostQueryService total',
        expected: p21Actual.totals.totalActualCost,
        actual: summary.cost.actualCost,
      });
    } else {
      rows.push({ status: 'MATCH', reason: 'Actual cost aligned with P2-1' });
    }

    const contract = await prisma.clientContract.findFirst({ where: { companyId, projectId } });
    if (contract) {
      const approvedNet = await prisma.contractVariationOrder.aggregate({
        where: { companyId, clientContractId: contract.id, status: 'APPROVED' },
        _sum: { netImpact: true },
      });
      const expectedRevised = Number(contract.totalContractValue) + Number(approvedNet._sum.netImpact ?? 0);
      if (Math.abs(expectedRevised - summary.revenue.revisedContractValue) > 0.02) {
        rows.push({
          status: 'REVISED_CONTRACT_MISMATCH',
          reason: 'Revised contract must match ClientContract + approved VO net',
          expected: expectedRevised,
          actual: summary.revenue.revisedContractValue,
        });
      }
    }

    const boqAllocatedSum = boq.items.reduce((s, i) => s + i.actualCost, 0);
    const projectAllocated = summary.cost.allocatedActualCost;
    if (Math.abs(boqAllocatedSum - projectAllocated) > 0.02) {
      rows.push({
        status: 'BOQ_PROJECT_TOTAL_MISMATCH',
        reason: 'Sum of BOQ allocated actual must match project allocated actual',
        expected: projectAllocated,
        actual: boqAllocatedSum,
      });
    }

    const commitment = await projectProfitabilityService.getCommitmentBreakdown(companyId, projectId);
    if (commitment.totals.remainingSubcontractCommitment < -0.02) {
      rows.push({
        status: 'COMMITMENT_UNDER_ACTUAL',
        reason: 'Remaining subcontract commitment cannot be negative',
        actual: commitment.totals.remainingSubcontractCommitment,
      });
    }

    const matchCount = rows.filter((r) => r.status === 'MATCH').length;
    return { projectId, rows, matchCount, issueCount: rows.length - matchCount };
  }
}

export const projectProfitabilityIntegrityService = new ProjectProfitabilityIntegrityService();
