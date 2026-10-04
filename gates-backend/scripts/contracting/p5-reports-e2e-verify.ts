#!/usr/bin/env tsx
/**
 * P5 Contracting Reports Center — reconcile report outputs with canonical P2/P2-2/P3.
 * Usage: DATABASE_URL=mysql://... tsx scripts/contracting/p5-reports-e2e-verify.ts
 */
import { PrismaClient } from '@prisma/client';
import { contractingReportsService } from '../../src/modules/contracting/reports/contracting-reports.service';
import { contractingReportsIntegrityService } from '../../src/modules/contracting/reports/contracting-reports-integrity.service';
import { projectProfitabilityService } from '../../src/modules/contracting/profitability/project-profitability.service';

const prisma = new PrismaClient();

type Step = { name: string; ok: boolean; detail?: string };
const steps: Step[] = [];

function step(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) {
    step('company exists', false, 'no company in DB');
    process.exit(1);
  }
  const companyId = company.id;

  const projects = await prisma.contractingProject.findMany({
    where: { companyId, status: 'ACTIVE', canonicalStack: 'ENTERPRISE' },
    take: 3,
    select: { id: true, projectCode: true },
  });
  step('enterprise active projects sample', projects.length > 0, `count=${projects.length}`);

  if (projects[0]) {
    const pid = projects[0].id;
    const [canonical, position, master] = await Promise.all([
      projectProfitabilityService.getProjectSummary(companyId, pid),
      contractingReportsService.getProjectFinancialPosition(companyId, pid),
      contractingReportsService.getProjectMaster(companyId, { projectId: pid }),
    ]);
    const row = master[0];
    const eacOk = Math.abs(Number(canonical.cost.eac) - position.cost.eac) < 0.02;
    step('financial position EAC = P2-2', eacOk, `P2-2=${canonical.cost.eac} report=${position.cost.eac}`);
    const actualOk =
      row && Math.abs(row.actualCost - position.cost.actual) < 0.02;
    step('master actual = position actual', Boolean(actualOk), row ? `${row.actualCost} vs ${position.cost.actual}` : 'no row');
    const profitOk =
      Math.abs(Number(canonical.cost.forecastProfit) - position.cost.forecastProfit) < 0.02;
    step('forecast profit = P2-2', profitOk);
  }

  const dash = await contractingReportsService.getManagementDashboard(companyId);
  const masterAll = await contractingReportsService.getProjectMaster(companyId, {});
  const sumRevised = masterAll.reduce((s, r) => s + r.revisedContractValue, 0);
  const dashRevised = Number(dash.portfolio.revisedContractValue ?? 0);
  step(
    'portfolio revised contract ≈ sum(project master)',
    Math.abs(sumRevised - dashRevised) < 1,
    `sum=${sumRevised} dash=${dashRevised}`
  );

  const integrity = await contractingReportsIntegrityService.reconcileCompany(companyId);
  step('integrity reconcile runs', integrity.projectCount >= 0, `passed=${integrity.passed}/${integrity.projectCount}`);

  const otherCo = await prisma.company.findFirst({
    where: { id: { not: companyId } },
    select: { id: true },
  });
  if (otherCo && projects[0]) {
    let isolated = false;
    try {
      await contractingReportsService.getProjectFinancialPosition(otherCo.id, projects[0].id);
    } catch {
      isolated = true;
    }
    step('tenant isolation financial position', isolated, 'cross-company lookup must 404');
  } else {
    step('tenant isolation financial position', true, 'skipped — single company DB');
  }

  const failed = steps.filter((s) => !s.ok);
  console.log(`\nP5 reports E2E: ${steps.length - failed.length}/${steps.length} passed`);
  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
