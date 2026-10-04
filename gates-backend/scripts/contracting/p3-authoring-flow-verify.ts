#!/usr/bin/env tsx
/** P3 execution plan authoring flow (service-level UI parity). */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { contractingProjectService } from '../../src/modules/contracting/services/contracting-project.service';
import { clientContractService } from '../../src/modules/contracting/client-billing/services/client-contract.service';
import { projectExecutionPlanService } from '../../src/modules/contracting/execution/project-execution-plan.service';
import { AppError } from '../../src/shared/middleware/error-handler';

const prisma = new PrismaClient();

async function main() {
  const suffix = `p3ui-${Date.now()}`;
  const company = await prisma.company.create({ data: { arabicName: `P3UI ${suffix}`, isActive: true } });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `p3ui-${suffix}@local`,
      username: `u${randomUUID().slice(0, 8)}`,
      passwordHash: 'x',
      isActive: true,
    },
  });
  await prisma.contractingSettings.create({ data: { companyId: company.id } });

  const project = await contractingProjectService.create(company.id, {
    projectCode: `P3UI-${suffix}`,
    projectName: 'Authoring UI Flow',
    contractValue: 5_000_000,
  });
  const customer = await prisma.customer.create({
    data: { companyId: company.id, arabicName: 'Cust', creditLimit: 1e9, priceTier: 'RETAIL' },
  });
  await clientContractService.createClientContract(company.id, {
    projectId: project.id,
    contractNumber: `CNT-${suffix}`,
    clientCustomerId: customer.id,
    contractDate: new Date('2026-01-01'),
    totalContractValue: 5_000_000,
  });
  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: company.id,
      projectId: project.id,
      itemCode: 'C-1',
      descriptionAr: 'Concrete',
      unit: 'M3',
      contractQuantity: new Decimal(1000),
      unitSellingPrice: new Decimal(5000),
      totalSellingPrice: new Decimal(5_000_000),
      directCostEstimated: new Decimal(3000),
      status: 'APPROVED_IN_CONTRACT',
    },
  });

  const plan = await projectExecutionPlanService.createPlan(company.id, project.id, {
    planName: 'مسودة 1',
    plannedStart: new Date('2026-01-01'),
    plannedFinish: new Date('2026-03-31'),
    createdBy: user.id,
  });
  await projectExecutionPlanService.updateDraftPlan(company.id, plan.id, {
    planName: 'مسودة محدثة',
  });

  const act = await projectExecutionPlanService.upsertActivity(company.id, plan.id, {
    code: 'A1',
    nameAr: 'نشاط 1',
    plannedStart: new Date('2026-01-01'),
    plannedFinish: new Date('2026-01-31'),
    weight: 50,
  });
  await projectExecutionPlanService.setBoqAllocation(company.id, act.id, {
    projectBOQItemId: boq.id,
    plannedQuantity: 500,
  });
  const ms = await projectExecutionPlanService.upsertMilestone(company.id, project.id, {
    executionPlanId: plan.id,
    nameAr: 'تسليم مرحلة 1',
    plannedDate: new Date('2026-02-01'),
  });

  await projectExecutionPlanService.approvePlan(company.id, plan.id, user.id);
  let editBlocked = false;
  try {
    await projectExecutionPlanService.upsertActivity(company.id, plan.id, {
      code: 'X',
      nameAr: 'x',
      plannedStart: new Date('2026-01-01'),
      plannedFinish: new Date('2026-01-02'),
    });
  } catch (e) {
    editBlocked = e instanceof AppError && e.statusCode === 422;
  }
  if (!editBlocked) throw new Error('Expected read-only after approve');

  await projectExecutionPlanService.activatePlan(company.id, plan.id);
  const rev = await projectExecutionPlanService.createRevisionFromActive(company.id, project.id, user.id);
  if (!rev || rev.status !== 'DRAFT') throw new Error('Revision draft missing');

  console.log('P3 AUTHORING UI FLOW VERIFIED');
  console.log({ planId: plan.id, milestoneId: ms.id, revisionPlanId: rev.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
