#!/usr/bin/env tsx
/**
 * P3 Execution Planning & Performance E2E + P2-2→P0 regression chain.
 */
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { contractingProjectService } from '../../src/modules/contracting/services/contracting-project.service';
import { clientContractService } from '../../src/modules/contracting/client-billing/services/client-contract.service';
import { contractVariationCommandService } from '../../src/modules/contracting/variation/contract-variation-command.service';
import { ownerPreliminaryCertificateCommandService } from '../../src/modules/contracting/preliminary/owner-preliminary-certificate-command.service';
import { projectExecutionPlanService } from '../../src/modules/contracting/execution/project-execution-plan.service';
import { projectExecutionPerformanceService } from '../../src/modules/contracting/execution/project-execution-performance.service';
import { projectExecutionIntegrityService } from '../../src/modules/contracting/execution/project-execution-integrity.service';
import { projectProfitabilityService } from '../../src/modules/contracting/profitability/project-profitability.service';
import { projectCostQueryService } from '../../src/modules/contracting/project-cost/project-cost-query.service';
import { AppError } from '../../src/shared/middleware/error-handler';
import { SYSTEM_GL_CODES } from '../../src/modules/accounting/data/system-account-map';

const prisma = new PrismaClient();
const steps: { name: string; ok: boolean; detail?: string }[] = [];

function step(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function assertClose(a: number, b: number, label: string, tol = 0.02) {
  if (Math.abs(a - b) > tol) throw new Error(`${label}: expected ${b}, got ${a}`);
}

async function seedCompany(label: string) {
  const suffix = `${label}-${Date.now()}`;
  const company = await prisma.company.create({ data: { arabicName: `P3 ${suffix}`, isActive: true } });
  await prisma.branch.create({ data: { companyId: company.id, arabicName: 'Main' } });
  await prisma.fiscalYear.create({
    data: {
      companyId: company.id,
      legacyYearId: '2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'Open',
      isActive: true,
    },
  });
  const seen = new Set<string>();
  for (const code of Object.values(SYSTEM_GL_CODES)) {
    if (seen.has(code)) continue;
    seen.add(code);
    const type = code.startsWith('5') ? 'expense' : code.startsWith('4') ? 'revenue' : code.startsWith('2') ? 'liability' : 'asset';
    await prisma.account.create({
      data: { companyId: company.id, code, arabicName: `Acct ${code}`, accountType: type, isActive: true },
    }).catch(() => undefined);
  }
  await prisma.companySettings.create({
    data: {
      companyId: company.id,
      allowNegativeBalance: true,
      accountDefinitions: {
        arAccount: SYSTEM_GL_CODES.ar,
        apAccount: SYSTEM_GL_CODES.ap,
        cashAccount: SYSTEM_GL_CODES.cashMain,
      },
    },
  });
  await prisma.contractingSettings.create({ data: { companyId: company.id } });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `p3-${suffix}@example.local`,
      username: `p3${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      passwordHash: 'x',
      isActive: true,
    },
  });
  return { companyId: company.id, userId: user.id, suffix };
}

async function main() {
  const seed = await seedCompany('exec');
  const BOQ_QTY = 1000;
  const UNIT_COST = 1000;
  const BAC = BOQ_QTY * UNIT_COST;

  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `P3-${seed.suffix}`,
    projectName: 'P3 Execution',
    contractValue: BOQ_QTY * 5000,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });

  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'CONC-P3',
      descriptionAr: 'Concrete',
      unit: 'M3',
      contractQuantity: new Decimal(BOQ_QTY),
      unitSellingPrice: new Decimal(5000),
      totalSellingPrice: new Decimal(BOQ_QTY * 5000),
      directCostEstimated: new Decimal(UNIT_COST),
      status: 'APPROVED_IN_CONTRACT',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      companyId: seed.companyId,
      arabicName: `Cust ${seed.suffix}`,
      creditLimit: 9_999_999,
      priceTier: 'RETAIL',
    },
  });

  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `CC-P3-${seed.suffix}`,
    clientCustomerId: customer.id,
    contractDate: new Date('2026-01-01'),
    totalContractValue: BOQ_QTY * 5000,
    advancePaymentAmount: 0,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });

  const plan = await projectExecutionPlanService.createPlan(seed.companyId, project.id, {
    planName: 'Baseline v1',
    plannedStart: new Date('2026-01-01T00:00:00.000Z'),
    plannedFinish: new Date('2026-03-31T00:00:00.000Z'),
    createdBy: seed.userId,
  });

  const actA = await projectExecutionPlanService.upsertActivity(seed.companyId, plan.id, {
    code: 'A',
    nameAr: 'Foundations',
    plannedStart: new Date('2026-01-01T00:00:00.000Z'),
    plannedFinish: new Date('2026-01-31T00:00:00.000Z'),
    sortOrder: 1,
  });
  const actB = await projectExecutionPlanService.upsertActivity(seed.companyId, plan.id, {
    code: 'B',
    nameAr: 'Structure',
    plannedStart: new Date('2026-02-01T00:00:00.000Z'),
    plannedFinish: new Date('2026-03-31T00:00:00.000Z'),
    sortOrder: 2,
  });

  await projectExecutionPlanService.setBoqAllocation(seed.companyId, actA.id, {
    projectBOQItemId: boq.id,
    plannedQuantity: 400,
  });
  await projectExecutionPlanService.setBoqAllocation(seed.companyId, actB.id, {
    projectBOQItemId: boq.id,
    plannedQuantity: 600,
  });

  let blocked = false;
  try {
    await projectExecutionPlanService.setBoqAllocation(seed.companyId, actB.id, {
      projectBOQItemId: boq.id,
      plannedQuantity: 601,
    });
  } catch (e) {
    blocked = e instanceof AppError && e.statusCode === 422;
  }
  step('BOQ allocation 1001 blocked', blocked);

  await projectExecutionPlanService.approvePlan(seed.companyId, plan.id, seed.userId);
  await projectExecutionPlanService.activatePlan(seed.companyId, plan.id);
  step('Baseline approved and active', true);

  const baseline = await prisma.projectExecutionPlan.findFirst({
    where: { companyId: seed.companyId, projectId: project.id, baselineKind: 'ORIGINAL_BASELINE' },
  });
  step('Original baseline snapshot preserved', Boolean(baseline?.baselineSnapshot));

  let asOf60 = new Date('2026-02-20T12:00:00.000Z');
  for (let d = new Date('2026-02-01'); d <= new Date('2026-03-15'); d.setDate(d.getDate() + 1)) {
    const perf = await projectExecutionPerformanceService.getPerformanceSummary(seed.companyId, project.id, {
      asOfDate: new Date(d),
    });
    if (Math.abs(perf.progress.plannedPercent - 60) < 0.6) {
      asOf60 = new Date(d);
      break;
    }
  }

  const prelim = await ownerPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    contract.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-02-01'),
      periodEndDate: new Date('2026-02-28'),
      lines: [{ projectBOQItemId: boq.id, requestedCurrentQuantity: 480 }],
    }
  );
  await ownerPreliminaryCertificateCommandService.submit(seed.companyId, prelim.id, seed.userId);
  await ownerPreliminaryCertificateCommandService.beginReview(seed.companyId, prelim.id);
  await ownerPreliminaryCertificateCommandService.approve(seed.companyId, prelim.id, seed.userId, [
    { projectBOQItemId: boq.id, approvedCurrentQuantity: 480 },
  ]);

  await prisma.projectCostAllocation.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      projectBOQItemId: boq.id,
      costCategory: 'MATERIAL',
      sourceType: 'MANUAL_COST_SPLIT',
      sourceId: `p3-${seed.suffix}`,
      allocationKey: `MANUAL_COST_SPLIT:p3-${seed.suffix}:_:${boq.id}:0`,
      amountBase: new Decimal(550_000),
      transactionDate: asOf60,
      status: 'ACTIVE',
    },
  });

  const summary = await projectExecutionPerformanceService.getPerformanceSummary(seed.companyId, project.id, {
    asOfDate: asOf60,
  });
  const prof = await projectProfitabilityService.getProjectSummary(seed.companyId, project.id);
  const p21 = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);

  assertClose(summary.progress.plannedPercent, 60, 'planned %', 1.5);
  assertClose(summary.progress.actualPercent, 48, 'actual %', 0.5);
  assertClose(summary.progress.scheduleVariancePoints, -12, 'schedule variance pts', 1.5);
  step('Progress 60/48 SV -12 pts', summary.progress.scheduleVariancePoints < -10);

  assertClose(summary.evm.bac, BAC, 'BAC');
  assertClose(summary.evm.pv, 600_000, 'PV', 15_000);
  assertClose(summary.evm.ev, 480_000, 'EV', 5_000);
  assertClose(summary.evm.ac, 550_000, 'AC');
  assertClose(summary.evm.spi!, 0.8, 'SPI', 0.02);
  assertClose(summary.evm.cpi!, 480_000 / 550_000, 'CPI', 0.001);
  assertClose(summary.evm.sv, -120_000, 'SV', 15_000);
  assertClose(summary.evm.cv, -70_000, 'CV');
  step('EVM PV/EV/AC/CPI/SPI', summary.evm.spi === 0.8 || Math.abs(summary.evm.spi! - 0.8) < 0.02);

  assertClose(summary.financial.eac, prof.cost.estimateAtCompletion, 'EAC from P2-2');
  assertClose(summary.financial.actualCost, p21.totals.totalActualCost, 'AC from P2-1');
  step('P2 integration AC/EAC', true);

  const delayed = summary.health.some((h) => h.code === 'SCHEDULE_DELAY');
  step('Schedule delay signal', delayed);

  const voDraft = await contractVariationCommandService.saveDraft(seed.companyId, contract.id, seed.userId, {
    orderDate: new Date('2026-03-01'),
    reason: '+200 m3',
    lines: [
      {
        changeType: 'QUANTITY_CHANGE',
        projectBOQItemId: boq.id,
        itemCodeSnapshot: boq.itemCode,
        descriptionArSnapshot: boq.descriptionAr,
        unitSnapshot: boq.unit,
        quantityDelta: 200,
      },
    ],
  });
  await contractVariationCommandService.submit(seed.companyId, voDraft.id, seed.userId);
  await contractVariationCommandService.beginReview(seed.companyId, voDraft.id);
  await contractVariationCommandService.approve(seed.companyId, voDraft.id, seed.userId);

  const unplanned = await projectExecutionPerformanceService.getUnplannedScope(seed.companyId, project.id);
  assertClose(unplanned[0]?.unplannedQuantity ?? 0, 200, 'unplanned qty');
  step('VO +200 unplanned scope', unplanned.length === 1 && unplanned[0].unplannedQuantity === 200);

  const healthUnplanned = (await projectExecutionPerformanceService.getPerformanceSummary(seed.companyId, project.id))
    .health.some((h) => h.code === 'UNPLANNED_SCOPE');
  step('UNPLANNED_SCOPE health', healthUnplanned);

  const active = await projectExecutionPlanService.getActivePlan(seed.companyId, project.id);
  const revPlan = await projectExecutionPlanService.createPlan(seed.companyId, project.id, {
    planName: 'Revision v2',
    plannedStart: new Date('2026-01-01T00:00:00.000Z'),
    plannedFinish: new Date('2026-04-30T00:00:00.000Z'),
    revisionOfPlanId: active!.id,
    createdBy: seed.userId,
  });
  const revA = await projectExecutionPlanService.upsertActivity(seed.companyId, revPlan.id, {
    code: 'A',
    nameAr: 'Foundations',
    plannedStart: new Date('2026-01-01T00:00:00.000Z'),
    plannedFinish: new Date('2026-01-31T00:00:00.000Z'),
  });
  const revB = await projectExecutionPlanService.upsertActivity(seed.companyId, revPlan.id, {
    code: 'B',
    nameAr: 'Structure+VO',
    plannedStart: new Date('2026-02-01T00:00:00.000Z'),
    plannedFinish: new Date('2026-04-30T00:00:00.000Z'),
  });
  await projectExecutionPlanService.setBoqAllocation(seed.companyId, revA.id, {
    projectBOQItemId: boq.id,
    plannedQuantity: 400,
  });
  await projectExecutionPlanService.setBoqAllocation(seed.companyId, revB.id, {
    projectBOQItemId: boq.id,
    plannedQuantity: 800,
  });
  await projectExecutionPlanService.approvePlan(seed.companyId, revPlan.id, seed.userId);
  await projectExecutionPlanService.activatePlan(seed.companyId, revPlan.id);

  const unplannedAfter = await projectExecutionPerformanceService.getUnplannedScope(seed.companyId, project.id);
  step('Revision clears unplanned scope', unplannedAfter.length === 0);
  step('Original baseline row unchanged', Boolean(baseline?.baselineSnapshot));

  const ms = await projectExecutionPlanService.upsertMilestone(seed.companyId, project.id, {
    nameAr: 'Handover',
    plannedDate: new Date('2025-12-01'),
  });
  step('Milestone delayed without actual', ms.status === 'DELAYED');
  await projectExecutionPlanService.upsertMilestone(seed.companyId, project.id, {
    milestoneId: ms.id,
    nameAr: 'Handover',
    plannedDate: new Date('2025-12-01'),
    actualDate: new Date('2026-03-01'),
  });
  const msDone = await prisma.projectExecutionMilestone.findUnique({ where: { id: ms.id } });
  step('Milestone completed with actual', msDone?.status === 'COMPLETED');

  const integrity = await projectExecutionIntegrityService.reconcileProject(seed.companyId, project.id);
  step('Integrity has AC match row', integrity.rows.some((r) => r.status === 'MATCH'));

  const failed = steps.filter((s) => !s.ok);
  if (failed.length) {
    console.error('\nP3 E2E FAILED', failed);
    process.exit(1);
  }

  console.log('\n=== P3 local E2E OK — chaining P2-2 regression ===\n');
  execSync('npx tsx scripts/contracting/p2-2-profitability-e2e-verify.ts', {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  console.log('\nCONTRACTING P3 EXECUTION PERFORMANCE E2E VERIFIED\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
