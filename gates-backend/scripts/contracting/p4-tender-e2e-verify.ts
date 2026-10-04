#!/usr/bin/env tsx
/**
 * P4 Tender → Quotation → Award E2E + P3 authoring + regression chain.
 */
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { contractTenderService } from '../../src/modules/contracting/tender/contract-tender.service';
import { contractTenderBoqService } from '../../src/modules/contracting/tender/contract-tender-boq.service';
import { contractTenderPricingService } from '../../src/modules/contracting/tender/contract-tender-pricing.service';
import { contractTenderQuotationService } from '../../src/modules/contracting/tender/contract-tender-quotation.service';
import { contractTenderAwardService } from '../../src/modules/contracting/tender/contract-tender-award.service';
import { tenderBoqExcelService } from '../../src/modules/contracting/tender/tender-boq-excel.service';
import { projectProfitabilityService } from '../../src/modules/contracting/profitability/project-profitability.service';
import { projectCostQueryService } from '../../src/modules/contracting/project-cost/project-cost-query.service';
import { projectExecutionPlanService } from '../../src/modules/contracting/execution/project-execution-plan.service';
import { AppError } from '../../src/shared/middleware/error-handler';
import { marginPercentFromSelling } from '../../src/modules/contracting/tender/contract-tender-pricing.util';

const prisma = new PrismaClient();

function assertClose(a: number, b: number, label: string, tol = 0.02) {
  if (Math.abs(a - b) > tol) throw new Error(`${label}: expected ${b}, got ${a}`);
}

async function seed() {
  const suffix = `p4-${Date.now()}`;
  const company = await prisma.company.create({ data: { arabicName: `P4 ${suffix}`, isActive: true } });
  await prisma.contractingSettings.create({ data: { companyId: company.id } });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `p4-${suffix}@local`,
      username: `p4${randomUUID().slice(0, 8)}`,
      passwordHash: 'x',
      isActive: true,
    },
  });
  const customer = await prisma.customer.create({
    data: { companyId: company.id, arabicName: 'عميل P4', creditLimit: 1e9, priceTier: 'RETAIL' },
  });
  return { companyId: company.id, userId: user.id, customerId: customer.id, suffix };
}

async function main() {
  execSync('npx tsx scripts/contracting/p3-authoring-flow-verify.ts', { cwd: process.cwd(), stdio: 'inherit' });

  const s = await seed();
  const tender = await contractTenderService.create(s.companyId, {
    customerId: s.customerId,
    nameAr: 'Concrete Package',
    createdBy: s.userId,
  });

  const line = await contractTenderBoqService.upsertLine(s.companyId, tender.id, {
    itemCode: 'CONC-1',
    descriptionAr: 'Concrete',
    unit: 'M3',
    quantity: 1000,
  });

  await contractTenderPricingService.setDirectUnitCost(s.companyId, line.id, 3000);
  const priced = await contractTenderPricingService.applyDefaultMarkup(s.companyId, tender.id, 0.2);
  assertClose(priced.directCost, 3_000_000, 'direct cost');
  assertClose(priced.sellingValue, 3_600_000, 'selling');
  assertClose(priced.expectedProfit, 600_000, 'profit');
  const margin = marginPercentFromSelling(3_000_000, 3_600_000)!;
  assertClose(margin, 16.666666, 'margin %', 0.01);

  const rev1 = await contractTenderQuotationService.createRevision(s.companyId, tender.id, s.userId);
  await contractTenderQuotationService.submit(s.companyId, rev1.id);
  const rev1Frozen = await prisma.contractQuotation.findUnique({ where: { id: rev1.id }, include: { lines: true } });

  const rev2 = await contractTenderQuotationService.createRevision(s.companyId, tender.id, s.userId);
  await contractTenderPricingService.setLinePricing(s.companyId, line.id, {
    pricingMethod: 'MANUAL_SELLING',
    sellingUnitRate: 3500,
  });
  await contractTenderQuotationService.submit(s.companyId, rev2.id);
  await contractTenderQuotationService.accept(s.companyId, rev2.id);

  const rev1After = await prisma.contractQuotation.findUnique({ where: { id: rev1.id }, include: { lines: true } });
  assertClose(Number(rev1After!.lines[0].lineAmountSnapshot), Number(rev1Frozen!.lines[0].lineAmountSnapshot), 'rev1 frozen');

  const idem = `award-${s.suffix}`;
  const award1 = await contractTenderAwardService.award(s.companyId, tender.id, rev2.id, {
    idempotencyKey: idem,
    awardedBy: s.userId,
    projectCode: `PRJ-P4-${s.suffix}`,
  });
  const award2 = await contractTenderAwardService.award(s.companyId, tender.id, rev2.id, {
    idempotencyKey: idem,
    awardedBy: s.userId,
  });
  if (award1.award.id !== award2.award.id) throw new Error('Idempotent award mismatch');

  const prof = await projectProfitabilityService.getProjectSummary(s.companyId, award1.project.id);
  const cost = await projectCostQueryService.getProjectSummary(s.companyId, award1.project.id);
  assertClose(prof.revenue.originalContractValue, 3_500_000, 'contract value rev2');
  assertClose(prof.cost.plannedCost, 3_000_000, 'planned cost transferred');
  assertClose(cost.totals.totalActualCost, 0, 'actual cost zero');

  const plan = await projectExecutionPlanService.createPlan(s.companyId, award1.project.id, {
    planName: 'Post-award plan',
    plannedStart: new Date('2026-01-01'),
    plannedFinish: new Date('2026-06-30'),
  });
  const act = await projectExecutionPlanService.upsertActivity(s.companyId, plan.id, {
    code: 'A',
    nameAr: 'Phase',
    plannedStart: new Date('2026-01-01'),
    plannedFinish: new Date('2026-03-31'),
  });
  const boq = await prisma.projectBOQItem.findFirst({ where: { projectId: award1.project.id } });
  await projectExecutionPlanService.setBoqAllocation(s.companyId, act.id, {
    projectBOQItemId: boq!.id,
    plannedQuantity: 1000,
  });

  const xlsx = await tenderBoqExcelService.buildFixtureBuffer([
    { code: 'X-1', desc: 'Item EN', unit: 'M3', qty: 10 },
    { code: 'X-2', desc: 'بند عربي', unit: 'M2', qty: 5 },
  ]);
  const preview = await tenderBoqExcelService.preview(xlsx);
  if (preview.invalidRowsCount < 1) throw new Error('Expected invalid excel row');
  const valid = preview.rows.filter((r) => r.isValid && r.data).map((r) => r.data!);
  const tender2 = await contractTenderService.create(s.companyId, {
    customerId: s.customerId,
    nameAr: 'Excel import',
  });
  await contractTenderBoqService.importLines(s.companyId, tender2.id, valid as never);

  await contractTenderService.markLost(s.companyId, tender2.id, { lostReason: 'Price' });
  let lostBlocked = false;
  try {
    await contractTenderAwardService.award(s.companyId, tender2.id, rev2.id, {});
  } catch (e) {
    lostBlocked = e instanceof AppError;
  }
  if (!lostBlocked) throw new Error('Lost tender must block award');

  console.log('\n=== P4 local E2E OK — chaining P3 regression ===\n');
  execSync('npx tsx scripts/contracting/p3-execution-e2e-verify.ts', { cwd: process.cwd(), stdio: 'inherit' });
  console.log('\nCONTRACTING P4 TENDER-TO-AWARD E2E VERIFIED\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
