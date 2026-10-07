#!/usr/bin/env tsx
/**
 * Idempotent Enterprise contracting + reports demo for a user company (default h@gmail.com).
 *
 *   npx tsx scripts/seed-contracting-demo-for-user.ts h@gmail.com
 *   railway ssh --service gates-backend -- npx tsx scripts/seed-contracting-demo-for-user.ts h@gmail.com
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { contractingProjectService } from '../src/modules/contracting/services/contracting-project.service';
import { clientContractService } from '../src/modules/contracting/client-billing/services/client-contract.service';
import { contractingReportsService } from '../src/modules/contracting/reports/contracting-reports.service';

const prisma = new PrismaClient();
const email = (process.argv[2] || 'h@gmail.com').trim().toLowerCase();
const PROJECT_CODE = 'DEMO-H-RAIL';
const PROJECT_CODE_2 = 'DEMO-H-RAIL-2';

async function ensureContractingLicense(companyId: string) {
  const modules = ['CONTRACTING', 'ACCOUNTING', 'INVENTORY', 'TREASURY', 'HR'];
  const sub = await prisma.tenantSubscription.findUnique({ where: { companyId } });
  if (!sub) {
    await prisma.tenantSubscription.create({
      data: {
        companyId,
        planType: 'ENTERPRISE',
        status: 'ACTIVE',
        startDate: new Date(),
        expiryDate: null,
        maxBranches: 10,
        maxUsers: 50,
        maxStorageMb: 8192,
        allowedModules: modules,
      },
    });
    return;
  }
  const allowed = new Set(Array.isArray(sub.allowedModules) ? sub.allowedModules : []);
  for (const m of modules) allowed.add(m);
  await prisma.tenantSubscription.update({
    where: { companyId },
    data: { allowedModules: [...allowed], status: 'ACTIVE' },
  });
}

async function ensureCustomer(companyId: string) {
  const name = 'عميل تجريبي Railway';
  const existing = await prisma.customer.findFirst({ where: { companyId, arabicName: name } });
  if (existing) return existing;
  return prisma.customer.create({
    data: { companyId, arabicName: name, creditLimit: new Decimal(9e9), priceTier: 'RETAIL' },
  });
}

async function seedProject(
  companyId: string,
  userId: string,
  customerId: string,
  projectCode: string,
  contractValue: number,
  voIncrease: number,
  actualCost: number,
  plannedCost: number,
  commitment: number
) {
  let project = await prisma.contractingProject.findFirst({
    where: { companyId, projectCode },
  });
  if (!project) {
    project = await contractingProjectService.create(companyId, {
      projectCode,
      projectName: `مشروع تجريبي ${projectCode}`,
      contractValue,
      customerId,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    });
  }

  let contract = await prisma.clientContract.findFirst({ where: { projectId: project.id } });
  if (!contract) {
    contract = await clientContractService.createClientContract(companyId, {
      projectId: project.id,
      contractNumber: `CC-${projectCode}`,
      clientCustomerId: customerId,
      contractDate: new Date('2026-01-01'),
      totalContractValue: contractValue,
      advancePaymentAmount: 0,
      advanceRecoveryRate: 0,
      retentionRate: 0.05,
      engineeringStampsRate: 0,
    });
  }

  const vo = await prisma.contractVariationOrder.findFirst({
    where: { companyId, clientContractId: contract.id, orderNumber: 'VO-DEMO-001' },
  });
  if (!vo && voIncrease > 0) {
    await prisma.contractVariationOrder.create({
      data: {
        companyId,
        projectId: project.id,
        clientContractId: contract.id,
        orderNumber: 'VO-DEMO-001',
        sequenceNumber: 1,
        orderDate: new Date('2026-02-01'),
        reason: 'بند تجريبي للتقارير',
        status: 'APPROVED',
        increaseValue: new Decimal(voIncrease),
        decreaseValue: new Decimal(0),
        netImpact: new Decimal(voIncrease),
        originalContractValueSnapshot: new Decimal(contractValue),
        revisedContractValueSnapshot: new Decimal(contractValue + voIncrease),
        approvedAt: new Date('2026-02-02'),
        approvedBy: userId,
      },
    });
  }

  let boq = await prisma.projectBOQItem.findFirst({
    where: { companyId, projectId: project.id, itemCode: 'DEMO-MAIN' },
  });
  if (!boq) {
    boq = await prisma.projectBOQItem.create({
      data: {
        companyId,
        projectId: project.id,
        itemCode: 'DEMO-MAIN',
        descriptionAr: 'أعمال تجريبية — Railway',
        unit: 'LS',
        contractQuantity: 1,
        unitSellingPrice: contractValue,
        totalSellingPrice: contractValue,
        directCostEstimated: plannedCost,
        status: 'APPROVED_IN_CONTRACT',
      },
    });
  }

  const allocKey = `MANUAL_COST_SPLIT:demo-${projectCode}:_:${boq.id}:0`;
  const alloc = await prisma.projectCostAllocation.findFirst({
    where: { companyId, allocationKey: allocKey },
  });
  if (!alloc) {
    await prisma.projectCostAllocation.create({
      data: {
        companyId,
        projectId: project.id,
        projectBOQItemId: boq.id,
        costCategory: 'MATERIAL',
        sourceType: 'MANUAL_COST_SPLIT',
        sourceId: `demo-${projectCode}`,
        allocationKey: allocKey,
        amountBase: new Decimal(actualCost),
        transactionDate: new Date('2026-03-15'),
        status: 'ACTIVE',
        description: 'تكلفة تجريبية للتقارير',
      },
    });
  }

  const invoice = await prisma.clientInvoice.findFirst({
    where: { companyId, clientContractId: contract.id, invoiceNumber: `CERT-${projectCode}` },
  });
  if (!invoice) {
    const net = Math.round((contractValue + voIncrease) * 0.36);
    await prisma.clientInvoice.create({
      data: {
        companyId,
        clientContractId: contract.id,
        invoiceNumber: `CERT-${projectCode}`,
        sequenceNumber: 1,
        periodStartDate: new Date('2026-03-01'),
        periodEndDate: new Date('2026-03-31'),
        type: 'INTERIM',
        status: 'FINANCE_POSTED',
        grossCurrentWorks: new Decimal(net),
        cumulativeGrossWorks: new Decimal(net),
        netPayableByClient: new Decimal(net * 0.9),
        collectedAmount: new Decimal(net * 0.6),
        remainingSettlementAmount: new Decimal(net * 0.3),
        settlementStatus: 'PARTIALLY_SETTLED',
      },
    });
  }

  const tender = await prisma.contractTender.findFirst({
    where: { companyId, tenderNumber: `TND-${projectCode}` },
  });
  if (!tender) {
    await prisma.contractTender.create({
      data: {
        companyId,
        tenderNumber: `TND-${projectCode}`,
        sequenceNumber: 1,
        customerId,
        nameAr: `عطاء ${projectCode}`,
        status: 'AWARDED',
        submissionDeadline: new Date('2025-11-01'),
      },
    });
  }

  if (commitment > 0) {
    const subcon = await prisma.subcontractor.findFirst({
      where: { companyId, nameAr: `باطن ${projectCode}` },
    });
    const subconId =
      subcon?.id ??
      (
        await prisma.subcontractor.create({
          data: { companyId, nameAr: `باطن ${projectCode}`, status: 'ACTIVE' },
        })
      ).id;
    let sub = await prisma.subcontract.findFirst({
      where: { companyId, projectId: project.id, subcontractNumber: `SUB-${projectCode}` },
    });
    if (!sub) {
      sub = await prisma.subcontract.create({
        data: {
          companyId,
          projectId: project.id,
          subcontractorId: subconId,
          subcontractNumber: `SUB-${projectCode}`,
          contractDate: new Date('2026-01-15'),
          totalContractValue: new Decimal(commitment),
          advancePaymentRecoveryRate: 0,
          retentionRate: 0,
          taxWithholdingRate: 0,
          socialInsuranceRate: 0,
          status: 'ACTIVE' as const,
        },
      });
    }
  }

  return project.id;
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true, companyId: true },
  });
  if (!user?.companyId) {
    console.error(`User ${email} not found or missing companyId`);
    process.exit(1);
  }
  const companyId = user.companyId;
  console.log('Seeding contracting demo for', user.email, companyId);

  await ensureContractingLicense(companyId);
  const customer = await ensureCustomer(companyId);

  const p1 = await seedProject(companyId, user.id, customer.id, PROJECT_CODE, 10_000_000, 1_000_000, 3_000_000, 7_000_000, 1_500_000);
  const p2 = await seedProject(companyId, user.id, customer.id, PROJECT_CODE_2, 5_000_000, 0, 1_200_000, 3_500_000, 800_000);

  const dash = await contractingReportsService.getManagementDashboard(companyId);
  const master = await contractingReportsService.getProjectMaster(companyId, {});

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        companyId,
        demoProjects: [PROJECT_CODE, PROJECT_CODE_2],
        projectIds: [p1, p2],
        reportsPortfolio: dash.portfolio,
        masterRows: master.length,
        links: {
          reports: '/contracting/reports',
          dashboard: '/contracting/reports/management-dashboard',
          projects: '/contracting/projects',
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
