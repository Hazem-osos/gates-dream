import prisma from '../../../shared/database/prisma';
import { projectCostQueryService } from '../project-cost/project-cost-query.service';
import { projectExecutionPerformanceService } from './project-execution-performance.service';
import { projectExecutionPlanService } from './project-execution-plan.service';

export type ExecutionIntegrityCode =
  | 'MATCH'
  | 'BOQ_OVER_ALLOCATED'
  | 'BOQ_UNDER_ALLOCATED'
  | 'UNAPPROVED_VO_SCOPE'
  | 'ACTUAL_EXCEEDS_PLANNED_SCOPE'
  | 'INVALID_ACTIVITY_DATES'
  | 'MISSING_BASELINE'
  | 'MISSING_BUDGET'
  | 'PROGRESS_SOURCE_MISMATCH'
  | 'EVM_TOTAL_MISMATCH'
  | 'CROSS_COMPANY_REFERENCE';

export type ExecutionIntegrityRow = {
  status: ExecutionIntegrityCode;
  reason: string;
  expected?: number | string | null;
  actual?: number | string | null;
};

export class ProjectExecutionIntegrityService {
  async reconcileProject(companyId: string, projectId: string) {
    const rows: ExecutionIntegrityRow[] = [];
    const plan = await projectExecutionPlanService.getActivePlan(companyId, projectId);
    const summary = await projectExecutionPerformanceService.getPerformanceSummary(companyId, projectId);
    const p21 = await projectCostQueryService.getProjectSummary(companyId, projectId);

    if (Math.abs(summary.evm.ac - p21.totals.totalActualCost) > 0.02) {
      rows.push({
        status: 'EVM_TOTAL_MISMATCH',
        reason: 'P3 AC must equal P2-1 actual cost',
        expected: p21.totals.totalActualCost,
        actual: summary.evm.ac,
      });
    } else {
      rows.push({ status: 'MATCH', reason: 'AC aligned with P2-1' });
    }

    if (Math.abs(summary.financial.actualCost - summary.evm.ac) > 0.02) {
      rows.push({
        status: 'EVM_TOTAL_MISMATCH',
        reason: 'Financial actualCost must match EVM AC',
        expected: summary.evm.ac,
        actual: summary.financial.actualCost,
      });
    }

    const baseline = await prisma.projectExecutionPlan.findFirst({
      where: { companyId, projectId, baselineKind: 'ORIGINAL_BASELINE' },
    });
    if (!baseline?.baselineSnapshot) {
      rows.push({ status: 'MISSING_BASELINE', reason: 'Original baseline snapshot missing' });
    }

    if (summary.evm.bac <= 0) {
      rows.push({ status: 'MISSING_BUDGET', reason: 'BAC / planned cost is zero' });
    }

    if (plan) {
      for (const act of plan.activities) {
        if (act.plannedFinish < act.plannedStart) {
          rows.push({
            status: 'INVALID_ACTIVITY_DATES',
            reason: `Activity ${act.code} finish before start`,
          });
        }
        if (act.companyId !== companyId || act.projectId !== projectId) {
          rows.push({ status: 'CROSS_COMPANY_REFERENCE', reason: `Activity ${act.code} tenant mismatch` });
        }
      }

      const allocSummary = await projectExecutionPerformanceService.getAllocationSummary(
        companyId,
        projectId,
        plan.id
      );
      for (const item of allocSummary?.items ?? []) {
        if (item.allocatedQuantity > item.effectiveQuantity + 0.0001) {
          rows.push({
            status: 'BOQ_OVER_ALLOCATED',
            reason: `BOQ ${item.itemCode} over-allocated`,
            expected: item.effectiveQuantity,
            actual: item.allocatedQuantity,
          });
        }
        if (item.effectiveQuantity - item.allocatedQuantity > 0.0001) {
          rows.push({
            status: 'BOQ_UNDER_ALLOCATED',
            reason: `BOQ ${item.itemCode} has unplanned approved scope`,
            expected: item.effectiveQuantity,
            actual: item.allocatedQuantity,
          });
        }
      }
    }

    const contract = await prisma.clientContract.findFirst({ where: { companyId, projectId } });
    if (contract) {
      const pendingVo = await prisma.contractVariationOrder.count({
        where: { companyId, clientContractId: contract.id, status: { not: 'APPROVED' } },
      });
      if (pendingVo > 0) {
        rows.push({
          status: 'UNAPPROVED_VO_SCOPE',
          reason: `${pendingVo} variation order(s) not approved — excluded from effective scope`,
        });
      }
    }

    const unplanned = await projectExecutionPerformanceService.getUnplannedScope(companyId, projectId);
    if (unplanned.length > 0) {
      rows.push({
        status: 'BOQ_UNDER_ALLOCATED',
        reason: 'Approved scope not fully distributed to active execution plan',
        actual: unplanned.length,
      });
    }

    const matchCount = rows.filter((r) => r.status === 'MATCH').length;
    return { projectId, companyId, ok: rows.every((r) => r.status === 'MATCH'), rows, matchCount };
  }
}

export const projectExecutionIntegrityService = new ProjectExecutionIntegrityService();
