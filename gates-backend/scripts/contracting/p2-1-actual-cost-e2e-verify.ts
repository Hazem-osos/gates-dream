#!/usr/bin/env tsx
/**
 * P2-1 Actual Project Cost E2E + P1/P0 regression chain.
 */
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { contractingProjectService } from '../../src/modules/contracting/services/contracting-project.service';
import { subcontractCommandService } from '../../src/modules/subcontracts/services/subcontract-command.service';
import { projectCostQueryService, projectCostSplitService } from '../../src/modules/contracting/project-cost/project-cost-query.service';
import { projectCostSyncService } from '../../src/modules/contracting/project-cost/project-cost-sync.service';

const prisma = new PrismaClient();
const steps: { name: string; ok: boolean; detail?: string }[] = [];

function step(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function seedCompany(label: string) {
  const suffix = `${label}-${Date.now()}`;
  const company = await prisma.company.create({ data: { arabicName: `P2-1 ${suffix}`, isActive: true } });
  await prisma.branch.create({ data: { companyId: company.id, arabicName: 'Main' } });
  return { companyId: company.id, userId: 'system', suffix };
}

async function main() {
  const seed = await seedCompany('p21');
  try {
    const cc = await prisma.costCenter.create({
      data: { companyId: seed.companyId, code: `CC-${seed.suffix}`, arabicName: 'Project CC' },
    });
    const project = await contractingProjectService.create(seed.companyId, {
      projectCode: `P21-${seed.suffix}`,
      projectName: 'P2-1 Cost',
      contractValue: 4_000_000,
      costCenterId: cc.id,
    });
    const boq = await prisma.projectBOQItem.create({
      data: {
        companyId: seed.companyId,
        projectId: project.id,
        itemCode: 'CONC',
        descriptionAr: 'Concrete',
        unit: 'M3',
        contractQuantity: 1000,
        unitSellingPrice: 4000,
        totalSellingPrice: 4_000_000,
        directCostEstimated: 2500,
        status: 'PRICED',
      },
    });

    const wh = await prisma.warehouse.create({
      data: { companyId: seed.companyId, arabicName: 'WH' },
    });
    const item = await prisma.item.create({
      data: { companyId: seed.companyId, arabicName: 'Cement', serial: `IT-${seed.suffix}` },
    });
    const issue = await prisma.issue.create({
      data: {
        companyId: seed.companyId,
        warehouseId: wh.id,
        date: new Date('2026-02-01'),
        serial: `ISS-${seed.suffix}`,
        isPosted: true,
        postedAt: new Date(),
        lines: {
          create: [
            {
              itemId: item.id,
              quantity: 100,
              unitPrice: 250,
              total: 25_000,
              contractingProjectId: project.id,
              projectBOQItemId: boq.id,
            },
          ],
        },
      },
      include: { lines: true },
    });
    await projectCostSyncService.syncPostedIssueInTx(prisma, seed.companyId, issue.id);
    let summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
    step('Inventory issue → material 25k', summary.totals.MATERIAL === 25_000, String(summary.totals.MATERIAL));

    await prisma.issue.update({ where: { id: issue.id }, data: { isPosted: false, isCancelled: true } });
    await projectCostSyncService.syncPostedIssueInTx(prisma, seed.companyId, issue.id);
    summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
    step('Issue cancel → material net 0', summary.totals.MATERIAL === 0, String(summary.totals.MATERIAL));

    await prisma.issue.update({ where: { id: issue.id }, data: { isPosted: true, isCancelled: false } });
    await projectCostSyncService.syncPostedIssueInTx(prisma, seed.companyId, issue.id);

    const subcon = await subcontractCommandService.createSubcontractor(seed.companyId, {
      nameAr: `Sub ${seed.suffix}`,
    });
    const sub = await subcontractCommandService.createSubcontract(seed.companyId, {
      subcontractorId: subcon.id,
      projectId: project.id,
      contractDate: new Date('2026-01-01'),
      totalContractValue: 2_000_000,
      advancePaymentRecoveryRate: 0.1,
      retentionRate: 0.1,
      taxWithholdingRate: 0,
      socialInsuranceRate: 0,
    });
    const subBoq = await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
      items: [
        {
          itemCode: 'CONC',
          descriptionAr: 'Sub concrete',
          unit: 'M3',
          contractQuantity: 500,
          unitPrice: 4000,
          maxAllowedQuantity: 500,
        },
      ],
    });
    const subBoqItem = subBoq.boqItems[0]!;
    const postedInv = await prisma.subcontractInvoice.create({
      data: {
        companyId: seed.companyId,
        subcontractId: sub.id,
        invoiceNumber: `SUB-${seed.suffix}`,
        sequenceNumber: 1,
        periodStartDate: new Date('2026-03-01'),
        periodEndDate: new Date('2026-03-31'),
        status: 'FINANCE_POSTED',
        grossCurrentAmount: 500_000,
        grossCumulativeAmount: 500_000,
        previousGrossAmount: 0,
        netPayableAmount: 400_000,
        retentionDeduction: 50_000,
        advancePaymentDeduction: 50_000,
        items: {
          create: [
            {
              subcontractBOQItemId: subBoqItem.id,
              currentQuantity: 125,
              previousQuantity: 0,
              totalCumulativeQuantity: 125,
              unitPrice: 4000,
              totalCurrentAmount: 500_000,
            },
          ],
        },
      },
    });
    await projectCostSyncService.syncSubcontractInvoiceInTx(prisma, seed.companyId, postedInv.id);
    summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
    step(
      'Sub invoice gross work cost (not net payable)',
      summary.totals.SUBCONTRACTOR === 500_000,
      `sub=${summary.totals.SUBCONTRACTOR}`
    );

    await projectCostSplitService.applyManualSplit(seed.companyId, {
      projectId: project.id,
      sourceType: 'MANUAL_COST_SPLIT',
      sourceId: `split-${seed.suffix}`,
      eligibleAmount: 100_000,
      transactionDate: new Date('2026-04-01'),
      splits: [
        { projectBOQItemId: boq.id, amountBase: 60_000, costCategory: 'OTHER' },
        { projectBOQItemId: boq.id, amountBase: 40_000, costCategory: 'OTHER' },
      ],
    });
    const boqBreak = await projectCostQueryService.getBoqBreakdown(seed.companyId, project.id);
    const boqRow = boqBreak.items.find((i) => i.projectBOQItemId === boq.id);
    step('Split 100k on BOQ', (boqRow?.totals.OTHER ?? 0) === 100_000);

    let blocked = false;
    try {
      await projectCostSplitService.applyManualSplit(seed.companyId, {
        projectId: project.id,
        sourceType: 'MANUAL_COST_SPLIT',
        sourceId: `split-bad-${seed.suffix}`,
        eligibleAmount: 50_000,
        transactionDate: new Date('2026-04-02'),
        splits: [{ projectBOQItemId: boq.id, amountBase: 60_000 }],
      });
    } catch {
      blocked = true;
    }
    step('Split over-allocation blocked', blocked);

    await projectCostSyncService.reverseSubcontractInvoiceInTx(prisma, seed.companyId, postedInv.id);
    summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
    step('Sub reversal clears subcontract cost', summary.totals.SUBCONTRACTOR === 0, String(summary.totals.SUBCONTRACTOR));
  } finally {
    await prisma.company.delete({ where: { id: seed.companyId } }).catch(() => undefined);
  }

  const failed = steps.filter((s) => !s.ok);
  console.log('\n=== P2-1 SUMMARY ===');
  console.log('Passed:', steps.filter((s) => s.ok).length, 'Failed:', failed.length);

  console.log('\n=== P1 REGRESSION ===');
  execSync('npx tsx scripts/contracting/p2-variation-e2e-verify.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });

  if (failed.length) {
    console.log('\nCONTRACTING P2-1 NOT VERIFIED');
    process.exit(1);
  }
  console.log('\nCONTRACTING P2-1 ACTUAL COST E2E VERIFIED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
