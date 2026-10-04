import { projectCostIntegrityService } from '../project-cost/project-cost-integrity.service';
import { projectProfitabilityIntegrityService } from '../profitability/project-profitability-integrity.service';
import { projectExecutionIntegrityService } from '../execution/project-execution-integrity.service';
import { contractingReportsService } from './contracting-reports.service';

export class ContractingReportsIntegrityService {
  async reconcileCompany(companyId: string, projectId?: string) {
    const master = await contractingReportsService.getProjectMaster(companyId, { projectId });
    const checks: Array<{ projectId: string; projectCode: string; ok: boolean; issues: string[] }> = [];

    for (const row of master) {
      const issues: string[] = [];
      const [p21, p22, p3] = await Promise.all([
        projectCostIntegrityService.reconcileProject(companyId, row.projectId),
        projectProfitabilityIntegrityService.reconcileProject(companyId, row.projectId),
        projectExecutionIntegrityService.reconcileProject(companyId, row.projectId),
      ]);
      if (p21.issueCount > 0) {
        issues.push(
          ...p21.rows.filter((r) => r.status !== 'MATCH').map((r) => `P2-1: ${r.reason}`)
        );
      }
      if (p22.issueCount > 0) {
        issues.push(
          ...p22.rows.filter((r) => r.status !== 'MATCH').map((r) => `P2-2: ${r.reason}`)
        );
      }
      if (!p3.ok) {
        issues.push(
          ...p3.rows.filter((r) => r.status !== 'MATCH').map((r) => `P3: ${r.reason}`)
        );
      }

      const position = await contractingReportsService.getProjectFinancialPosition(companyId, row.projectId);
      if (Math.abs(row.actualCost - position.cost.actual) > 0.02) {
        issues.push(`Report actual ${row.actualCost} ≠ P2-1 ${position.cost.actual}`);
      }
      if (Math.abs(row.eac - position.cost.eac) > 0.02) {
        issues.push(`Report EAC ${row.eac} ≠ P2-2 ${position.cost.eac}`);
      }

      checks.push({
        projectId: row.projectId,
        projectCode: row.projectCode,
        ok: issues.length === 0,
        issues,
      });
    }

    return {
      projectCount: checks.length,
      passed: checks.filter((c) => c.ok).length,
      failed: checks.filter((c) => !c.ok).length,
      checks,
      note: 'Read-only diagnostics — no auto-repair',
    };
  }
}

export const contractingReportsIntegrityService = new ContractingReportsIntegrityService();
