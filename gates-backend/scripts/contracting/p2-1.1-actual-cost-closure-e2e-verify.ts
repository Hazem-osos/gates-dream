#!/usr/bin/env tsx
/**
 * P2-1.1 Actual Cost Closure — treasury wiring proof, integrity, VO item, P0-4 sub reversal.
 */
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SYSTEM_GL_CODES } from '../../src/modules/accounting/data/system-account-map';
import { journalEntryService } from '../../src/modules/accounting/services/journal-entry.service';
import { cashTransactionService } from '../../src/modules/treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../../src/modules/treasury/services/treasury-posting.service';
import type { TreasuryPostingContext } from '../../src/modules/treasury/types/treasury.types';
import { contractingProjectService } from '../../src/modules/contracting/services/contracting-project.service';
import { clientContractService } from '../../src/modules/contracting/client-billing/services/client-contract.service';
import { contractVariationCommandService } from '../../src/modules/contracting/variation/contract-variation-command.service';
import { projectCostQueryService } from '../../src/modules/contracting/project-cost/project-cost-query.service';
import { projectCostSyncService } from '../../src/modules/contracting/project-cost/project-cost-sync.service';
import { projectCostIntegrityService } from '../../src/modules/contracting/project-cost/project-cost-integrity.service';
import { buildProjectCostAllocationKey } from '../../src/modules/contracting/project-cost/project-cost-allocation.util';
import { subcontractCommandService } from '../../src/modules/subcontracts/services/subcontract-command.service';
import { subcontractInvoiceCommandService } from '../../src/modules/subcontracts/services/subcontract-invoice-command.service';
import { contractingCertificateReversalService } from '../../src/modules/contracting/reversal/contracting-certificate-reversal.service';
import { contractingCertificateSettlementService } from '../../src/modules/contracting/settlement/contracting-certificate-settlement.service';

const prisma = new PrismaClient();
const steps: { name: string; ok: boolean; detail?: string }[] = [];

function step(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function idemKey(label: string) {
  return `${label}-${randomUUID()}`;
}

async function createAccount(companyId: string, code: string, arabicName: string, accountType: string) {
  const existing = await prisma.account.findFirst({ where: { companyId, code, deletedAt: null } });
  if (existing) return existing;
  return prisma.account.create({
    data: { companyId, code, arabicName, accountType, isActive: true },
  });
}

async function seedCompany(label: string) {
  const suffix = `${label}-${Date.now()}`;
  const company = await prisma.company.create({
    data: { arabicName: `P2-1.1 ${suffix}`, isActive: true },
  });
  const branch = await prisma.branch.create({
    data: { companyId: company.id, arabicName: `Branch ${suffix}` },
  });
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
  const codes: Array<[string, string, string]> = [];
  for (const code of Object.values(SYSTEM_GL_CODES)) {
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push([
      code,
      `Acct ${code}`,
      code.startsWith('2') || code.startsWith('3')
        ? 'liability'
        : code.startsWith('4')
          ? 'revenue'
          : code.startsWith('5')
            ? 'expense'
            : 'asset',
    ]);
  }
  for (const [code, fallback] of Object.entries({
    '1410': 'asset',
    '2110': 'liability',
    '1610': 'asset',
    '2465': 'liability',
    '2411': 'liability',
    '2412': 'liability',
    '1310': 'asset',
    '4210': 'revenue',
    '4220': 'revenue',
    '1415': 'asset',
  })) {
    if (!seen.has(code)) codes.push([code, `Acct ${code}`, fallback]);
  }
  for (const [code, name, type] of codes) {
    await createAccount(company.id, code, `${name} ${suffix}`, type);
  }
  await createAccount(company.id, '5210', 'Site expenses', 'expense');

  const cashGl = await prisma.account.findFirstOrThrow({
    where: { companyId: company.id, code: SYSTEM_GL_CODES.cashMain },
  });

  await prisma.companySettings.create({
    data: {
      companyId: company.id,
      allowNegativeBalance: true,
      preventCashOverdraft: false,
      accountDefinitions: {
        arAccount: SYSTEM_GL_CODES.ar,
        apAccount: SYSTEM_GL_CODES.ap,
        cashAccount: SYSTEM_GL_CODES.cashMain,
      },
    },
  });
  await prisma.contractingSettings.create({ data: { companyId: company.id } });

  const safe = await prisma.safe.create({
    data: {
      companyId: company.id,
      code: `SF${suffix.slice(-5)}`,
      arabicName: `Safe ${suffix}`,
      currencyCode: 'EGP',
      glAccountId: cashGl.id,
      isActive: true,
    },
  });
  await prisma.branch.update({ where: { id: branch.id }, data: { defaultSafeId: safe.id } });

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `p211-${suffix}@example.local`,
      username: `p211${randomUUID().replace(/-/g, '').slice(0, 14)}`,
      passwordHash: 'test',
      firstName: 'P211',
      lastName: 'E2E',
    },
  });

  return {
    companyId: company.id,
    branchId: branch.id,
    fiscalYearId: fiscalYear.id,
    safeId: safe.id,
    userId: user.id,
    suffix,
  };
}

function treasuryCtx(seed: Awaited<ReturnType<typeof seedCompany>>): TreasuryPostingContext {
  return {
    companyId: seed.companyId,
    branchId: seed.branchId,
    fiscalYearId: seed.fiscalYearId,
    userId: seed.userId,
    isAdmin: true,
  };
}

function journalCtx(seed: Awaited<ReturnType<typeof seedCompany>>) {
  return journalEntryService.buildPostingContext(
    seed.companyId,
    seed.branchId,
    seed.userId,
    seed.fiscalYearId,
    true
  );
}

async function treasuryDirectExpenseFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const tctx = treasuryCtx(seed);
  const cc = await prisma.costCenter.create({
    data: { companyId: seed.companyId, code: `CC-${seed.suffix}`, arabicName: 'Project CC' },
  });
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `P211-${seed.suffix}`,
    projectName: 'Treasury cost',
    contractValue: 2_000_000,
    costCenterId: cc.id,
  });
  const expenseAccount = await prisma.account.findFirstOrThrow({
    where: { companyId: seed.companyId, code: '5210' },
  });

  let summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
  step('Treasury: before post DIRECT_EXPENSE=0', summary.totals.DIRECT_EXPENSE === 0, String(summary.totals.DIRECT_EXPENSE));

  const created = await cashTransactionService.create(
    seed.companyId,
    seed.branchId,
    seed.fiscalYearId,
    {
      transactionKind: 'PAYMENT',
      date: new Date('2026-02-15'),
      amount: 50_000,
      currencyCode: 'EGP',
      exchangeRate: 1,
      safeId: seed.safeId,
      description: 'Site misc expense',
      lines: [
        {
          accountId: expenseAccount.id,
          amount: 50_000,
          entrySide: 'DEBIT',
          costCenterId: cc.id,
        },
      ],
    },
    seed.userId
  );

  await treasuryPostingService.postCashTransaction(tctx, created.id);
  summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
  step('Treasury: post DIRECT_EXPENSE=50k', summary.totals.DIRECT_EXPENSE === 50_000, String(summary.totals.DIRECT_EXPENSE));

  await projectCostSyncService.syncPostedCashTransactionInTx(prisma, seed.companyId, created.id);
  summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
  step('Treasury: idempotent re-sync still 50k', summary.totals.DIRECT_EXPENSE === 50_000);

  await treasuryPostingService.unpostCashTransaction(tctx, created.id);
  summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
  step('Treasury: unpost DIRECT_EXPENSE=0', summary.totals.DIRECT_EXPENSE === 0, String(summary.totals.DIRECT_EXPENSE));

  await treasuryPostingService.postCashTransaction(tctx, created.id);
  summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
  step('Treasury: repost DIRECT_EXPENSE=50k once', summary.totals.DIRECT_EXPENSE === 50_000);

  const activeDirect = await prisma.projectCostAllocation.count({
    where: {
      companyId: seed.companyId,
      projectId: project.id,
      costCategory: 'DIRECT_EXPENSE',
      status: 'ACTIVE',
    },
  });
  step('Treasury: single ACTIVE direct allocation', activeDirect === 1, String(activeDirect));

  return { project, tctx, expenseAccount, cc };
}

async function subcontractPaymentNotDirectExpense(
  seed: Awaited<ReturnType<typeof seedCompany>>,
  projectId: string,
  tctx: TreasuryPostingContext
) {
  const jctx = journalCtx(seed);
  const subcon = await subcontractCommandService.createSubcontractor(seed.companyId, {
    nameAr: `Sub ${seed.suffix}`,
  });
  const sub = await subcontractCommandService.createSubcontract(seed.companyId, {
    subcontractorId: subcon.id,
    projectId,
    contractDate: new Date('2026-01-01'),
    totalContractValue: 500_000,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
  });
  const boqUpsert = await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [
      {
        itemCode: 'SUB-W',
        descriptionAr: 'Sub work',
        unit: 'LS',
        contractQuantity: 1,
        unitPrice: 100_000,
      },
    ],
  });
  const subBoqId = boqUpsert.boqItems[0]!.id;
  const draft = await subcontractInvoiceCommandService.createOrUpdateDraftInvoice(
    seed.companyId,
    sub.id,
    {
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      items: [{ subcontractBOQItemId: subBoqId, currentQuantity: 1 }],
    }
  );
  await subcontractInvoiceCommandService.submitToSiteEngineer(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.approveByConsultant(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.approveByTechOffice(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.lockAndPostInvoice(seed.companyId, draft.id, jctx);

  let summary = await projectCostQueryService.getProjectSummary(seed.companyId, projectId);
  const subBefore = summary.totals.SUBCONTRACTOR;
  const directBefore = summary.totals.DIRECT_EXPENSE;

  await contractingCertificateSettlementService.paySubcontractInvoice(tctx, draft.id, {
    idempotencyKey: idemKey('sub-pay'),
    amount: Number((await prisma.subcontractInvoice.findFirstOrThrow({ where: { id: draft.id } })).netPayableAmount),
    safeId: seed.safeId,
    date: new Date('2026-04-01'),
  });

  summary = await projectCostQueryService.getProjectSummary(seed.companyId, projectId);
  step(
    'Sub invoice payment does not add DIRECT_EXPENSE',
    summary.totals.DIRECT_EXPENSE === directBefore && summary.totals.SUBCONTRACTOR === subBefore,
    `direct=${summary.totals.DIRECT_EXPENSE} sub=${summary.totals.SUBCONTRACTOR}`
  );
}

async function integrityFixtures(seed: Awaited<ReturnType<typeof seedCompany>>, projectId: string) {
  const boq = await prisma.projectBOQItem.findFirstOrThrow({ where: { projectId, companyId: seed.companyId } });
  const issue = await prisma.issue.create({
    data: {
      companyId: seed.companyId,
      warehouseId: (await prisma.warehouse.create({ data: { companyId: seed.companyId, arabicName: 'WH2' } })).id,
      date: new Date('2026-02-01'),
      serial: `ISS-INT-${seed.suffix}`,
      isPosted: true,
      lines: {
        create: [
          {
            itemId: (await prisma.item.create({
              data: { companyId: seed.companyId, arabicName: 'Mat', serial: `M-${seed.suffix}` },
            })).id,
            quantity: 10,
            unitPrice: 1000,
            total: 10_000,
            contractingProjectId: projectId,
            projectBOQItemId: boq.id,
          },
        ],
      },
    },
    include: { lines: true },
  });
  await projectCostSyncService.syncPostedIssueInTx(prisma, seed.companyId, issue.id);
  let report = await projectCostIntegrityService.reconcileProject(seed.companyId, projectId);
  step(
    'Integrity: healthy inventory MATCH',
    report.rows.some((r) => r.sourceType === 'INVENTORY_ISSUE_LINE' && r.status === 'MATCH')
  );

  const healthySub = report.rows.find((r) => r.sourceType === 'SUBCONTRACT_INVOICE_ITEM' && r.status === 'MATCH');
  step('Integrity: healthy subcontract MATCH', Boolean(healthySub));

  const healthyTreasury = report.rows.find(
    (r) => r.sourceType === 'CASH_TRANSACTION_LINE' && r.status === 'MATCH'
  );
  step('Integrity: healthy treasury MATCH', Boolean(healthyTreasury));

  const lineId = issue.lines[0]!.id;
  const dupKey = buildProjectCostAllocationKey({
    sourceType: 'INVENTORY_ISSUE_LINE',
    sourceId: issue.id,
    sourceLineId: lineId,
    projectBOQItemId: boq.id,
    slot: 'dup',
  });
  await prisma.projectCostAllocation.create({
    data: {
      companyId: seed.companyId,
      projectId,
      projectBOQItemId: boq.id,
      costCategory: 'MATERIAL',
      sourceType: 'INVENTORY_ISSUE_LINE',
      sourceId: issue.id,
      sourceLineId: lineId,
      allocationKey: dupKey,
      amountBase: new Decimal(10_000),
      transactionDate: issue.date,
      status: 'ACTIVE',
    },
  });
  report = await projectCostIntegrityService.reconcileProject(seed.companyId, projectId);
  step(
    'Integrity: duplicate ACTIVE → DUPLICATE_SOURCE',
    report.rows.some((r) => r.status === 'DUPLICATE_SOURCE')
  );

  await prisma.projectCostAllocation.deleteMany({
    where: { companyId: seed.companyId, allocationKey: dupKey },
  });

  await prisma.projectCostAllocation.update({
    where: {
      companyId_allocationKey: {
        companyId: seed.companyId,
        allocationKey: buildProjectCostAllocationKey({
          sourceType: 'INVENTORY_ISSUE_LINE',
          sourceId: issue.id,
          sourceLineId: lineId,
          projectBOQItemId: boq.id,
        }),
      },
    },
    data: { amountBase: new Decimal(25_000) },
  });
  report = await projectCostIntegrityService.reconcileProject(seed.companyId, projectId);
  step(
    'Integrity: over source amount → OVER_ALLOCATED',
    report.rows.some((r) => r.status === 'OVER_ALLOCATED')
  );

  await prisma.issue.update({ where: { id: issue.id }, data: { isPosted: false, isCancelled: true } });
  report = await projectCostIntegrityService.reconcileProject(seed.companyId, projectId);
  step(
    'Integrity: cancelled issue ACTIVE alloc → INVALID/MISSING',
    report.rows.some((r) => r.status === 'INVALID_SOURCE_STATE' || r.status === 'MISSING_REVERSAL')
  );

  const otherCo = await prisma.company.create({ data: { arabicName: `Other ${seed.suffix}`, isActive: true } });
  const crossAlloc = await prisma.projectCostAllocation.findFirst({
    where: {
      companyId: seed.companyId,
      projectId,
      sourceType: 'INVENTORY_ISSUE_LINE',
      sourceLineId: lineId,
    },
  });
  if (crossAlloc) {
    await prisma.projectCostAllocation.create({
      data: {
        companyId: otherCo.id,
        projectId,
        projectBOQItemId: boq.id,
        costCategory: 'MATERIAL',
        sourceType: 'INVENTORY_ISSUE_LINE',
        sourceId: issue.id,
        sourceLineId: lineId,
        allocationKey: `${crossAlloc.allocationKey}:xco`,
        amountBase: new Decimal(1),
        transactionDate: issue.date,
        status: 'ACTIVE',
      },
    });
    report = await projectCostIntegrityService.reconcileProject(seed.companyId, projectId);
    step(
      'Integrity: tampered company → CROSS_COMPANY_ALLOCATION',
      report.rows.some((r) => r.status === 'CROSS_COMPANY_ALLOCATION')
    );
    await prisma.projectCostAllocation.deleteMany({ where: { companyId: otherCo.id } });
    await prisma.company.delete({ where: { id: otherCo.id } }).catch(() => undefined);
  }
}

async function voNewItemCostFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const cc = await prisma.costCenter.create({
    data: { companyId: seed.companyId, code: `CC-VO-${seed.suffix}`, arabicName: 'VO CC' },
  });
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `VO-${seed.suffix}`,
    projectName: 'VO item cost',
    contractValue: 1_000_000,
    costCenterId: cc.id,
  });
  const customer = await prisma.customer.create({
    data: {
      companyId: seed.companyId,
      arabicName: `Cust VO ${seed.suffix}`,
      creditLimit: 9_999_999,
      priceTier: 'RETAIL',
    },
  });
  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `CC-VO-${seed.suffix}`,
    clientCustomerId: customer.id,
    contractDate: new Date('2026-03-01'),
    totalContractValue: 1_000_000,
    advancePaymentAmount: 0,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });

  const voNew = await contractVariationCommandService.saveDraft(seed.companyId, contract.id, seed.userId, {
    orderDate: new Date('2026-06-01'),
    reason: 'Add item',
    lines: [
      {
        changeType: 'NEW_ITEM',
        itemCodeSnapshot: 'VO-NEW-1',
        descriptionArSnapshot: 'VO new scope',
        unitSnapshot: 'M2',
        quantityDelta: 100,
        approvedRate: 200,
      },
    ],
  });
  await contractVariationCommandService.submit(seed.companyId, voNew.id, seed.userId);
  await contractVariationCommandService.beginReview(seed.companyId, voNew.id);
  const approved = await contractVariationCommandService.approve(seed.companyId, voNew.id, seed.userId);
  const newLine = approved.lines.find((l) => l.changeType === 'NEW_ITEM');
  const voBoqId = newLine?.createdProjectBOQItemId;
  step('VO NEW_ITEM BOQ row', Boolean(voBoqId));

  const wh = await prisma.warehouse.create({ data: { companyId: seed.companyId, arabicName: 'WH-VO' } });
  const item = await prisma.item.create({
    data: { companyId: seed.companyId, arabicName: 'VO Mat', serial: `VOI-${seed.suffix}` },
  });
  const issue = await prisma.issue.create({
    data: {
      companyId: seed.companyId,
      warehouseId: wh.id,
      date: new Date('2026-06-15'),
      serial: `VO-ISS-${seed.suffix}`,
      isPosted: true,
      lines: {
        create: [
          {
            itemId: item.id,
            quantity: 50,
            unitPrice: 80,
            total: 4000,
            contractingProjectId: project.id,
            projectBOQItemId: voBoqId!,
          },
        ],
      },
    },
  });
  await projectCostSyncService.syncPostedIssueInTx(prisma, seed.companyId, issue.id);

  const boqBreak = await projectCostQueryService.getBoqBreakdown(seed.companyId, project.id);
  const voRow = boqBreak.items.find((i) => i.projectBOQItemId === voBoqId);
  step('VO item in BOQ actual breakdown', (voRow?.totals.MATERIAL ?? 0) === 4000, String(voRow?.totals.MATERIAL));

  const summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
  step('VO item in project total', summary.totals.MATERIAL === 4000, String(summary.totals.MATERIAL));

  const sources = await projectCostQueryService.listSources(seed.companyId, project.id, {
    projectBOQItemId: voBoqId!,
  });
  step('VO item source drilldown', sources.length >= 1, String(sources.length));

  const integrity = await projectCostIntegrityService.reconcileProject(seed.companyId, project.id);
  step(
    'VO item integrity MATCH',
    integrity.rows.some(
      (r) => r.projectBOQItemId === voBoqId && r.sourceType === 'INVENTORY_ISSUE_LINE' && r.status === 'MATCH'
    )
  );
}

async function p04SubReversalFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const jctx = journalCtx(seed);
  const cc = await prisma.costCenter.create({
    data: { companyId: seed.companyId, code: `CC-R-${seed.suffix}`, arabicName: 'Rev CC' },
  });
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `REV-${seed.suffix}`,
    projectName: 'P0-4 sub rev',
    contractValue: 800_000,
    costCenterId: cc.id,
  });
  await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'REV-1',
      descriptionAr: 'Owner BOQ',
      unit: 'LS',
      contractQuantity: 1,
      unitSellingPrice: 800_000,
      totalSellingPrice: 800_000,
      status: 'APPROVED_IN_CONTRACT',
    },
  });

  const subcon = await subcontractCommandService.createSubcontractor(seed.companyId, {
    nameAr: `SubRev ${seed.suffix}`,
  });
  const sub = await subcontractCommandService.createSubcontract(seed.companyId, {
    subcontractorId: subcon.id,
    projectId: project.id,
    contractDate: new Date('2026-05-01'),
    totalContractValue: 200_000,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
  });
  await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [
      {
        itemCode: 'REV-1',
        descriptionAr: 'Sub rev work',
        unit: 'LS',
        contractQuantity: 1,
        unitPrice: 200_000,
      },
    ],
  });
  const detail = await subcontractCommandService.getSubcontract(seed.companyId, sub.id);
  const draft = await subcontractInvoiceCommandService.createOrUpdateDraftInvoice(
    seed.companyId,
    sub.id,
    {
      periodStartDate: new Date('2026-05-01'),
      periodEndDate: new Date('2026-05-31'),
      items: [{ subcontractBOQItemId: detail.boqItems[0]!.id, currentQuantity: 1 }],
    }
  );
  await subcontractInvoiceCommandService.submitToSiteEngineer(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.approveByConsultant(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.approveByTechOffice(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.lockAndPostInvoice(seed.companyId, draft.id, jctx);

  let summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
  step('P0-4: finance posted sub cost > 0', summary.totals.SUBCONTRACTOR > 0, String(summary.totals.SUBCONTRACTOR));

  const historyBefore = await prisma.projectCostAllocation.count({
    where: { companyId: seed.companyId, projectId: project.id, sourceId: draft.id },
  });

  await contractingCertificateReversalService.reverseSubcontractInvoice(jctx, draft.id, {
    idempotencyKey: idemKey('p04-sub'),
    reason: 'P2-1.1 reversal proof',
  });

  summary = await projectCostQueryService.getProjectSummary(seed.companyId, project.id);
  step('P0-4: subcontract actual net 0', summary.totals.SUBCONTRACTOR === 0, String(summary.totals.SUBCONTRACTOR));

  const historyAfter = await prisma.projectCostAllocation.count({
    where: { companyId: seed.companyId, projectId: project.id, sourceId: draft.id },
  });
  step('P0-4: allocation audit rows retained', historyAfter >= historyBefore, `${historyBefore}→${historyAfter}`);

  const reversedRows = await prisma.projectCostAllocation.count({
    where: {
      companyId: seed.companyId,
      sourceId: draft.id,
      status: 'REVERSED',
    },
  });
  step('P0-4: allocations marked REVERSED', reversedRows >= 1, String(reversedRows));
}

async function main() {
  const seed = await seedCompany('p211');
  try {
    const { project, tctx } = await treasuryDirectExpenseFlow(seed);
    await prisma.projectBOQItem.create({
      data: {
        companyId: seed.companyId,
        projectId: project.id,
        itemCode: 'BASE',
        descriptionAr: 'Base BOQ',
        unit: 'LS',
        contractQuantity: 1,
        unitSellingPrice: 1,
        totalSellingPrice: 1,
        status: 'APPROVED_IN_CONTRACT',
      },
    });

    await subcontractPaymentNotDirectExpense(seed, project.id, tctx);
    await integrityFixtures(seed, project.id);
    await voNewItemCostFlow(seed);
    await p04SubReversalFlow(seed);
  } finally {
    await prisma.company.delete({ where: { id: seed.companyId } }).catch(() => undefined);
  }

  const failed = steps.filter((s) => !s.ok);
  console.log('\n=== P2-1.1 CLOSURE SUMMARY ===');
  console.log('Passed:', steps.filter((s) => s.ok).length, 'Failed:', failed.length);

  if (failed.length) {
    console.log('\nCONTRACTING P2-1 ACTUAL COST PRODUCT INCOMPLETE');
    process.exit(1);
  }

  console.log('\n=== P2-1 REGRESSION ===');
  execSync('npx tsx scripts/contracting/p2-1-actual-cost-e2e-verify.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });

  console.log('\nCONTRACTING P2-1 ACTUAL COST PRODUCT COMPLETE');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
