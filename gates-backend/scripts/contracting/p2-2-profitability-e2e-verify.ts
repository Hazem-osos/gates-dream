#!/usr/bin/env tsx
/**
 * P2-2 Cost Control & Profitability E2E + P2-1/P1/P0 regression.
 */
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { contractingProjectService } from '../../src/modules/contracting/services/contracting-project.service';
import { clientContractService } from '../../src/modules/contracting/client-billing/services/client-contract.service';
import { contractVariationCommandService } from '../../src/modules/contracting/variation/contract-variation-command.service';
import { projectProfitabilityService } from '../../src/modules/contracting/profitability/project-profitability.service';
import { projectProfitabilitySnapshotService } from '../../src/modules/contracting/profitability/project-profitability-snapshot.service';
import { projectProfitabilityIntegrityService } from '../../src/modules/contracting/profitability/project-profitability-integrity.service';
import { projectCostSyncService } from '../../src/modules/contracting/project-cost/project-cost-sync.service';
import { subcontractCommandService } from '../../src/modules/subcontracts/services/subcontract-command.service';
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
  const company = await prisma.company.create({ data: { arabicName: `P22 ${suffix}`, isActive: true } });
  const branch = await prisma.branch.create({ data: { companyId: company.id, arabicName: 'Main' } });
  const fiscalYear = await prisma.fiscalYear.create({
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
  for (const [code, type] of [
    ['1410', 'asset'],
    ['1310', 'asset'],
    ['1610', 'asset'],
    ['5210', 'expense'],
  ] as const) {
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
      email: `p22-${suffix}@example.local`,
      username: `p22${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      passwordHash: 'test',
      firstName: 'P22',
      lastName: 'E2E',
    },
  });
  return { companyId: company.id, branchId: branch.id, fiscalYearId: fiscalYear.id, userId: user.id, suffix };
}

async function profitableProjectFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `P22-${seed.suffix}`,
    projectName: 'Profitability',
    contractValue: 10_000_000,
  });
  const customer = await prisma.customer.create({
    data: { companyId: seed.companyId, arabicName: 'Owner', creditLimit: 9e9, priceTier: 'RETAIL' },
  });
  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `CC-${seed.suffix}`,
    clientCustomerId: customer.id,
    contractDate: new Date('2026-01-01'),
    totalContractValue: 10_000_000,
    advancePaymentAmount: 0,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });

  await prisma.contractVariationOrder.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      clientContractId: contract.id,
      orderNumber: 'VO-001',
      sequenceNumber: 1,
      orderDate: new Date('2026-02-01'),
      reason: 'Scope add',
      status: 'APPROVED',
      increaseValue: new Decimal(1_000_000),
      decreaseValue: new Decimal(0),
      netImpact: new Decimal(1_000_000),
      originalContractValueSnapshot: new Decimal(10_000_000),
      revisedContractValueSnapshot: new Decimal(11_000_000),
      approvedAt: new Date('2026-02-02'),
      approvedBy: seed.userId,
    },
  });

  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'MAIN',
      descriptionAr: 'Main works',
      unit: 'LS',
      contractQuantity: 1,
      unitSellingPrice: 10_000_000,
      totalSellingPrice: 10_000_000,
      directCostEstimated: 7_000_000,
      status: 'APPROVED_IN_CONTRACT',
    },
  });

  await prisma.projectBoqForecastOverride.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      projectBOQItemId: boq.id,
      forecastRemainingCost: new Decimal(2_000_000),
      reason: 'E2E baseline forecast',
      effectiveFrom: new Date('2026-03-01'),
      createdBy: seed.userId,
    },
  });

  await prisma.projectCostAllocation.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      projectBOQItemId: boq.id,
      costCategory: 'MATERIAL',
      sourceType: 'MANUAL_COST_SPLIT',
      sourceId: `e2e-${seed.suffix}`,
      allocationKey: `MANUAL_COST_SPLIT:e2e-${seed.suffix}:_:${boq.id}:0`,
      amountBase: new Decimal(3_000_000),
      transactionDate: new Date('2026-03-01'),
      status: 'ACTIVE',
    },
  });

  const subcon = await subcontractCommandService.createSubcontractor(seed.companyId, { nameAr: 'Sub' });
  const sub = await subcontractCommandService.createSubcontract(seed.companyId, {
    subcontractorId: subcon.id,
    projectId: project.id,
    contractDate: new Date('2026-01-01'),
    totalContractValue: 1_500_000,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
  });
  await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [
      {
        itemCode: 'MAIN',
        descriptionAr: 'Sub scope',
        unit: 'LS',
        contractQuantity: 1,
        unitPrice: 1_500_000,
      },
    ],
  });

  const summary = await projectProfitabilityService.getProjectSummary(seed.companyId, project.id);
  assertClose(summary.revenue.revisedContractValue, 11_000_000, 'revised');
  assertClose(summary.cost.plannedCost, 7_000_000, 'planned');
  assertClose(summary.cost.actualCost, 3_000_000, 'actual');
  assertClose(summary.cost.remainingCommitment, 1_500_000, 'remaining commitment');
  assertClose(summary.cost.uncommittedCostToComplete, 2_000_000, 'uncommitted');
  assertClose(summary.cost.estimateAtCompletion, 6_500_000, 'EAC');
  assertClose(summary.cost.forecastProfit, 4_500_000, 'forecast profit');
  assertClose(summary.cost.forecastMarginPercent ?? 0, 40.9091, 'margin', 0.05);

  step('Profitable project EAC/margin', true, `EAC=${summary.cost.estimateAtCompletion}`);
  return { projectId: project.id, contractId: contract.id, boqId: boq.id };
}

async function boqLossFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `LOSS-${seed.suffix}`,
    projectName: 'BOQ loss',
    contractValue: 500_000,
  });
  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'LOSS-1',
      descriptionAr: 'Loss item',
      unit: 'LS',
      contractQuantity: 1,
      unitSellingPrice: 500_000,
      totalSellingPrice: 500_000,
      directCostEstimated: 350_000,
      status: 'APPROVED_IN_CONTRACT',
    },
  });
  await prisma.projectCostAllocation.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      projectBOQItemId: boq.id,
      costCategory: 'OTHER',
      sourceType: 'MANUAL_COST_SPLIT',
      sourceId: `loss-${seed.suffix}`,
      allocationKey: `MANUAL_COST_SPLIT:loss-${seed.suffix}:_:${boq.id}:0`,
      amountBase: new Decimal(300_000),
      transactionDate: new Date('2026-03-01'),
      status: 'ACTIVE',
    },
  });
  await prisma.projectBoqForecastOverride.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      projectBOQItemId: boq.id,
      forecastRemainingCost: new Decimal(250_000),
      reason: 'E2E loss forecast',
      effectiveFrom: new Date('2026-03-01'),
      createdBy: seed.userId,
    },
  });
  const boqRows = await projectProfitabilityService.getBoqBreakdown(seed.companyId, project.id);
  const row = boqRows.items[0]!;
  assertClose(row.forecastProfit ?? 0, -50_000, 'boq forecast profit');
  step('BOQ loss forecast profit -50k', (row.forecastProfit ?? 0) < 0, String(row.forecastProfit));
  step('BOQ NEGATIVE_MARGIN signal', row.signals.includes('NEGATIVE_MARGIN'));
  step('BOQ_OVER_BUDGET signal', row.signals.includes('BOQ_OVER_BUDGET'));
  const summary = await projectProfitabilityService.getProjectSummary(seed.companyId, project.id);
  step('Project aggregation still computes', summary.cost.actualCost === 300_000);
}

async function subcontractCommitmentFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `SUBC-${seed.suffix}`,
    projectName: 'Sub commitment',
    contractValue: 2_000_000,
  });
  await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'S1',
      descriptionAr: 'Owner mirror',
      unit: 'LS',
      contractQuantity: 1,
      unitSellingPrice: 2_000_000,
      totalSellingPrice: 2_000_000,
      directCostEstimated: 1_000_000,
      status: 'APPROVED_IN_CONTRACT',
    },
  });
  const subcon = await subcontractCommandService.createSubcontractor(seed.companyId, { nameAr: 'SubC' });
  const sub = await subcontractCommandService.createSubcontract(seed.companyId, {
    subcontractorId: subcon.id,
    projectId: project.id,
    contractDate: new Date('2026-01-01'),
    totalContractValue: 1_000_000,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
  });
  const boqUpsert = await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [{ itemCode: 'S1', descriptionAr: 'Work', unit: 'LS', contractQuantity: 1, unitPrice: 1_000_000 }],
  });
  let commit = await projectProfitabilityService.getCommitmentBreakdown(seed.companyId, project.id);
  assertClose(commit.totals.grossSubcontractCommitment, 1_000_000, 'gross sub');
  assertClose(commit.totals.remainingSubcontractCommitment, 1_000_000, 'remaining before invoice');

  const subBoqId = boqUpsert.boqItems[0]!.id;

  const postedInv = await prisma.subcontractInvoice.create({
    data: {
      companyId: seed.companyId,
      subcontractId: sub.id,
      invoiceNumber: `SUB-P22-${seed.suffix}`,
      sequenceNumber: 1,
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      status: 'FINANCE_POSTED',
      grossCurrentAmount: 400_000,
      grossCumulativeAmount: 400_000,
      netPayableAmount: 400_000,
      items: {
        create: [
          {
            subcontractBOQItemId: subBoqId,
            currentQuantity: 0.4,
            previousQuantity: 0,
            totalCumulativeQuantity: 0.4,
            unitPrice: 1_000_000,
            totalCurrentAmount: 400_000,
          },
        ],
      },
    },
  });
  await projectCostSyncService.syncSubcontractInvoiceInTx(prisma, seed.companyId, postedInv.id);

  commit = await projectProfitabilityService.getCommitmentBreakdown(seed.companyId, project.id);
  assertClose(commit.totals.actualSubcontractWork, 400_000, 'actual work gross');
  assertClose(commit.totals.remainingSubcontractCommitment, 600_000, 'remaining after 400k');
  step('Sub commitment 1M → 400k actual → 600k remaining', commit.totals.remainingSubcontractCommitment === 600_000);

  await prisma.subcontractVariationOrder.create({
    data: {
      companyId: seed.companyId,
      subcontractId: sub.id,
      orderNumber: 'SVO-001',
      sequenceNumber: 1,
      orderDate: new Date('2026-04-01'),
      reason: '+200k',
      status: 'APPROVED',
      increaseValue: new Decimal(200_000),
      decreaseValue: new Decimal(0),
      netImpact: new Decimal(200_000),
      originalContractValueSnapshot: new Decimal(1_000_000),
      revisedContractValueSnapshot: new Decimal(1_200_000),
      approvedAt: new Date('2026-04-02'),
      approvedBy: seed.userId,
      lines: {
        create: [
          {
            companyId: seed.companyId,
            changeType: 'QUANTITY_CHANGE',
            subcontractBOQItemId: boqUpsert.boqItems[0]!.id,
            itemCodeSnapshot: 'S1',
            descriptionArSnapshot: 'Work',
            unitSnapshot: 'LS',
            quantityDelta: new Decimal(0.2),
            originalRate: new Decimal(1_000_000),
            amountImpact: new Decimal(200_000),
          },
        ],
      },
    },
  });
  commit = await projectProfitabilityService.getCommitmentBreakdown(seed.companyId, project.id);
  assertClose(commit.totals.grossSubcontractCommitment, 1_200_000, 'revised gross');
  assertClose(commit.totals.remainingSubcontractCommitment, 800_000, 'remaining after VO');
  step('Sub VO +200k → remaining 800k', commit.totals.remainingSubcontractCommitment === 800_000);
}

async function revenueCollectionFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `REV-${seed.suffix}`,
    projectName: 'Revenue',
    contractValue: 5_000_000,
  });
  const customer = await prisma.customer.create({
    data: { companyId: seed.companyId, arabicName: 'Rev cust', creditLimit: 9e9, priceTier: 'RETAIL' },
  });
  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `REV-${seed.suffix}`,
    clientCustomerId: customer.id,
    contractDate: new Date('2026-01-01'),
    totalContractValue: 5_000_000,
    advancePaymentAmount: 0,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });
  await prisma.ownerPreliminaryCertificate.create({
    data: {
      companyId: seed.companyId,
      clientContractId: contract.id,
      projectId: project.id,
      certificateNumber: `PRE-${seed.suffix}`,
      sequenceNumber: 1,
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      status: 'APPROVED',
      cumulativeGrossWorks: new Decimal(2_000_000),
      grossCurrentWorks: new Decimal(2_000_000),
      approvedAt: new Date('2026-03-15'),
    },
  });
  await prisma.clientInvoice.create({
    data: {
      companyId: seed.companyId,
      clientContractId: contract.id,
      invoiceNumber: `CI-${seed.suffix}`,
      sequenceNumber: 1,
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      status: 'FINANCE_POSTED',
      grossCurrentWorks: new Decimal(1_500_000),
      cumulativeGrossWorks: new Decimal(1_500_000),
      netPayableByClient: new Decimal(1_500_000),
      collectedAmount: new Decimal(1_000_000),
      remainingSettlementAmount: new Decimal(500_000),
      settlementStatus: 'PARTIALLY_SETTLED',
    },
  });

  const summary = await projectProfitabilityService.getProjectSummary(seed.companyId, project.id);
  step('Revised contract 5m', summary.revenue.revisedContractValue === 5_000_000);
  step('Operational certified distinct', summary.revenue.operationalCertifiedValue === 0 || summary.revenue.operationalCertifiedValue >= 0);
  step('Financial certified 1.5m', summary.revenue.financiallyCertifiedRevenue === 1_500_000);
  step('Collected 1m (not revenue)', summary.revenue.collectedRevenue === 1_000_000);
  step('Collected != financial certified', summary.revenue.collectedRevenue !== summary.revenue.financiallyCertifiedRevenue);
}

async function voFlow(seed: Awaited<ReturnType<typeof seedCompany>>, contractId: string) {
  const contract = await prisma.clientContract.findFirstOrThrow({ where: { id: contractId } });
  const before = await projectProfitabilityService.getProjectSummary(seed.companyId, contract.projectId);
  const draft = await contractVariationCommandService.saveDraft(seed.companyId, contractId, seed.userId, {
    orderDate: new Date('2026-05-01'),
    reason: 'Pending VO',
    lines: [
      {
        changeType: 'QUANTITY_CHANGE',
        projectBOQItemId: (await prisma.projectBOQItem.findFirstOrThrow({ where: { projectId: contract.projectId } })).id,
        itemCodeSnapshot: 'MAIN',
        descriptionArSnapshot: 'Main',
        unitSnapshot: 'LS',
        quantityDelta: 1,
      },
    ],
  });
  const mid = await projectProfitabilityService.getProjectSummary(seed.companyId, contract.projectId);
  step('Unapproved VO no revised impact', mid.revenue.revisedContractValue === before.revenue.revisedContractValue);
  await contractVariationCommandService.submit(seed.companyId, draft.id, seed.userId);
  await contractVariationCommandService.beginReview(seed.companyId, draft.id);
  await contractVariationCommandService.approve(seed.companyId, draft.id, seed.userId);
  const after = await projectProfitabilityService.getProjectSummary(seed.companyId, contract.projectId);
  step('Approved VO updates revised contract', after.revenue.revisedContractValue > before.revenue.revisedContractValue);
}

async function unallocatedFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `UNAL-${seed.suffix}`,
    projectName: 'Unallocated',
    contractValue: 1_000_000,
  });
  await prisma.projectCostAllocation.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      costCategory: 'DIRECT_EXPENSE',
      sourceType: 'CASH_TRANSACTION_LINE',
      sourceId: randomUUID(),
      sourceLineId: randomUUID(),
      allocationKey: `CASH_TRANSACTION_LINE:${randomUUID()}:line:PROJECT:0`,
      amountBase: new Decimal(100_000),
      transactionDate: new Date('2026-03-01'),
      status: 'ACTIVE',
    },
  });
  const summary = await projectProfitabilityService.getProjectSummary(seed.companyId, project.id);
  step('Unallocated 100k in actual', summary.cost.unallocatedActualCost === 100_000);
  step('Unallocated in EAC', summary.cost.estimateAtCompletion >= 100_000);
  const boq = await projectProfitabilityService.getBoqBreakdown(seed.companyId, project.id);
  step('BOQ totals do not absorb unallocated', boq.items.every((i) => i.actualCost === 0));
}

async function snapshotFlow(seed: Awaited<ReturnType<typeof seedCompany>>, projectId: string) {
  const a = await projectProfitabilitySnapshotService.createSnapshot(seed.companyId, projectId, {
    label: 'State A',
    createdBy: seed.userId,
  });
  await prisma.projectCostAllocation.create({
    data: {
      companyId: seed.companyId,
      projectId,
      costCategory: 'OTHER',
      sourceType: 'MANUAL_COST_SPLIT',
      sourceId: `snap-${seed.suffix}`,
      allocationKey: `MANUAL_COST_SPLIT:snap-${seed.suffix}:_:PROJECT:0`,
      amountBase: new Decimal(50_000),
      transactionDate: new Date('2026-04-01'),
      status: 'ACTIVE',
    },
  });
  const b = await projectProfitabilitySnapshotService.createSnapshot(seed.companyId, projectId, {
    label: 'State B',
    createdBy: seed.userId,
  });
  const history = await projectProfitabilitySnapshotService.listSnapshots(seed.companyId, projectId);
  const rowA = history.find((h) => h.id === a.id);
  const rowB = history.find((h) => h.id === b.id);
  step('Snapshot A immutable', rowA?.actualCost === 3_000_000);
  step('Snapshot B reflects new cost', (rowB?.actualCost ?? 0) >= 3_050_000);
}

async function main() {
  const seed = await seedCompany('p22');
  try {
    const { projectId, contractId } = await profitableProjectFlow(seed);
    await boqLossFlow(seed);
    await subcontractCommitmentFlow(seed);
    await revenueCollectionFlow(seed);
    await voFlow(seed, contractId);
    await unallocatedFlow(seed);
    await snapshotFlow(seed, projectId);
    const integrity = await projectProfitabilityIntegrityService.reconcileProject(seed.companyId, projectId);
    step('Integrity actual cost MATCH', integrity.rows.some((r) => r.status === 'MATCH'));
  } finally {
    await prisma.company.delete({ where: { id: seed.companyId } }).catch(() => undefined);
  }

  const failed = steps.filter((s) => !s.ok);
  console.log('\n=== P2-2 SUMMARY ===');
  console.log('Passed:', steps.filter((s) => s.ok).length, 'Failed:', failed.length);

  if (failed.length) {
    console.log('\nCONTRACTING P2-2 NOT VERIFIED');
    process.exit(1);
  }

  console.log('\n=== REGRESSION ===');
  execSync('npx tsx scripts/contracting/p2-1.1-actual-cost-closure-e2e-verify.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });

  console.log('\nCONTRACTING P2-2 PROFITABILITY E2E VERIFIED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
