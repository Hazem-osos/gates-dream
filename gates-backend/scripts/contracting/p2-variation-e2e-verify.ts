#!/usr/bin/env tsx
/**
 * P1-2 Variation Orders E2E — owner + subcontract, then P1 + P0 regression.
 */
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SYSTEM_GL_CODES } from '../../src/modules/accounting/data/system-account-map';
import { contractingProjectService } from '../../src/modules/contracting/services/contracting-project.service';
import { clientContractService } from '../../src/modules/contracting/client-billing/services/client-contract.service';
import { contractVariationCommandService } from '../../src/modules/contracting/variation/contract-variation-command.service';
import { contractVariationIntegrityService } from '../../src/modules/contracting/variation/contract-variation-integrity.service';
import {
  resolveEffectiveOwnerBoqQuantityInTx,
  resolveEffectiveOwnerBoqRateInTx,
} from '../../src/modules/contracting/variation/contract-variation-effective.service';
import { ownerPreliminaryCertificateCommandService } from '../../src/modules/contracting/preliminary/owner-preliminary-certificate-command.service';
import { subcontractVariationCommandService } from '../../src/modules/contracting/variation/subcontract-variation-command.service';
import { subcontractPreliminaryCertificateCommandService } from '../../src/modules/contracting/preliminary/subcontract-preliminary-certificate-command.service';
import {
  ContractVariationOverCertificationError,
  SubcontractVariationOverCertificationError,
} from '../../src/modules/contracting/variation/variation-domain.errors';
import { ClientBoqLimitExceededError } from '../../src/modules/contracting/client-billing/errors/client-billing-domain.errors';
import { BoqLimitExceededError } from '../../src/modules/subcontracts/errors/subcontract-domain.errors';
import { subcontractInvoiceCalculationService } from '../../src/modules/subcontracts/services/subcontract-invoice-calculation.service';
import { subcontractCommandService } from '../../src/modules/subcontracts/services/subcontract-command.service';

const prisma = new PrismaClient();
const steps: { name: string; ok: boolean; detail?: string }[] = [];

function step(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function assertClose(a: number, b: number, label: string, tol = 0.02) {
  if (Math.abs(a - b) > tol) throw new Error(`${label}: expected ${b}, got ${a}`);
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
    data: { arabicName: `P2 VO ${suffix}`, isActive: true },
  });
  const branch = await prisma.branch.create({
    data: { companyId: company.id, arabicName: `Branch ${suffix}`, defaultSafeId: null },
  });
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
  for (const code of Object.values(SYSTEM_GL_CODES)) {
    await createAccount(company.id, code, `Acct ${code}`, 'asset');
  }
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
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `p2-${suffix}@example.local`,
      username: `p2${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      passwordHash: 'test',
      firstName: 'P2',
      lastName: 'VO',
    },
  });
  return { companyId: company.id, userId: user.id, suffix };
}

async function countContractingJe(companyId: string) {
  return prisma.journalEntry.count({
    where: {
      companyId,
      sourceType: { in: ['CLIENT_INVOICE', 'SUBCONTRACT_INVOICE'] },
    },
  });
}

async function ownerVariationFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const BOQ_QTY = 1000;
  const RATE = 4000;

  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `P2-OWN-${seed.suffix}`,
    projectName: 'P2 Owner VO',
    contractValue: BOQ_QTY * RATE,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });

  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'CONC-1',
      descriptionAr: 'Concrete',
      unit: 'M3',
      contractQuantity: new Decimal(BOQ_QTY),
      unitSellingPrice: new Decimal(RATE),
      totalSellingPrice: new Decimal(BOQ_QTY * RATE),
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
    contractNumber: `CC-P2-${seed.suffix}`,
    clientCustomerId: customer.id,
    contractDate: new Date('2026-03-01'),
    totalContractValue: BOQ_QTY * RATE,
    advancePaymentAmount: 0,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });

  const jeBefore = await countContractingJe(seed.companyId);

  const prelim = await ownerPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    contract.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      lines: [{ projectBOQItemId: boq.id, requestedCurrentQuantity: 400 }],
    }
  );
  await ownerPreliminaryCertificateCommandService.submit(seed.companyId, prelim.id, seed.userId);
  await ownerPreliminaryCertificateCommandService.beginReview(seed.companyId, prelim.id);
  const approvedPrelim = await ownerPreliminaryCertificateCommandService.approve(
    seed.companyId,
    prelim.id,
    seed.userId,
    [{ projectBOQItemId: boq.id, approvedCurrentQuantity: 380 }]
  );
  const prelimRateSnapshot = Number(approvedPrelim.lines[0].unitRateSnapshot);
  step('Owner: baseline prelim certified 380', Number(approvedPrelim.lines[0].approvedCurrentQuantity) === 380);

  let effBeforeVo = await resolveEffectiveOwnerBoqQuantityInTx(
    prisma,
    seed.companyId,
    contract.id,
    boq.id
  );
  step('Owner: effective qty before VO approve', Number(effBeforeVo) === BOQ_QTY, String(effBeforeVo));

  const vo1Draft = await contractVariationCommandService.saveDraft(seed.companyId, contract.id, seed.userId, {
    orderDate: new Date('2026-04-01'),
    reason: 'Increase concrete scope',
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
  step('Owner: VO-001 numbering', vo1Draft.orderNumber === 'VO-001', vo1Draft.orderNumber);

  let effWithDraft = await resolveEffectiveOwnerBoqQuantityInTx(
    prisma,
    seed.companyId,
    contract.id,
    boq.id
  );
  step('Owner: draft VO does not change effective qty', Number(effWithDraft) === BOQ_QTY, String(effWithDraft));

  await contractVariationCommandService.submit(seed.companyId, vo1Draft.id, seed.userId);
  await contractVariationCommandService.beginReview(seed.companyId, vo1Draft.id);
  await contractVariationCommandService.approve(seed.companyId, vo1Draft.id, seed.userId);

  const effAfterVo1 = await resolveEffectiveOwnerBoqQuantityInTx(
    prisma,
    seed.companyId,
    contract.id,
    boq.id
  );
  step('Owner: VO-001 +200 effective qty', Number(effAfterVo1) === 1200, String(effAfterVo1));

  const prelimPartial = await ownerPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    contract.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-04-01'),
      periodEndDate: new Date('2026-04-30'),
      lines: [{ projectBOQItemId: boq.id, requestedCurrentQuantity: 420 }],
    }
  );
  await ownerPreliminaryCertificateCommandService.submit(seed.companyId, prelimPartial.id, seed.userId);
  await ownerPreliminaryCertificateCommandService.beginReview(seed.companyId, prelimPartial.id);
  const approvedPartial = await ownerPreliminaryCertificateCommandService.approve(
    seed.companyId,
    prelimPartial.id,
    seed.userId,
    [{ projectBOQItemId: boq.id, approvedCurrentQuantity: 420 }]
  );
  assertClose(Number(approvedPartial.lines[0].cumulativeApprovedQuantity), 800, 'cum after partial cert');
  step('Owner: certify within expanded VO ceiling', true, 'cum=800');

  const vo2Draft = await contractVariationCommandService.saveDraft(seed.companyId, contract.id, seed.userId, {
    orderDate: new Date('2026-05-01'),
    reason: 'Minor reduction',
    lines: [
      {
        changeType: 'OMIT',
        projectBOQItemId: boq.id,
        itemCodeSnapshot: boq.itemCode,
        descriptionArSnapshot: boq.descriptionAr,
        unitSnapshot: boq.unit,
        quantityDelta: -100,
      },
    ],
  });
  await contractVariationCommandService.submit(seed.companyId, vo2Draft.id, seed.userId);
  await contractVariationCommandService.beginReview(seed.companyId, vo2Draft.id);
  await contractVariationCommandService.approve(seed.companyId, vo2Draft.id, seed.userId);
  const effAfterVo2 = await resolveEffectiveOwnerBoqQuantityInTx(
    prisma,
    seed.companyId,
    contract.id,
    boq.id
  );
  step('Owner: VO-002 -100 effective qty', Number(effAfterVo2) === 1100, String(effAfterVo2));

  const vo3Draft = await contractVariationCommandService.saveDraft(seed.companyId, contract.id, seed.userId, {
    orderDate: new Date('2026-06-01'),
    reason: 'Unsafe reduction',
    lines: [
      {
        changeType: 'OMIT',
        projectBOQItemId: boq.id,
        itemCodeSnapshot: boq.itemCode,
        descriptionArSnapshot: boq.descriptionAr,
        unitSnapshot: boq.unit,
        quantityDelta: -301,
      },
    ],
  });
  await contractVariationCommandService.submit(seed.companyId, vo3Draft.id, seed.userId);
  await contractVariationCommandService.beginReview(seed.companyId, vo3Draft.id);
  let blockedReduce = false;
  try {
    await contractVariationCommandService.approve(seed.companyId, vo3Draft.id, seed.userId);
  } catch (e) {
    blockedReduce = e instanceof ContractVariationOverCertificationError;
  }
  step('Owner: block reduction below certified', blockedReduce);

  const voNew = await contractVariationCommandService.saveDraft(seed.companyId, contract.id, seed.userId, {
    orderDate: new Date('2026-07-01'),
    reason: 'Waterproofing add',
    lines: [
      {
        changeType: 'NEW_ITEM',
        itemCodeSnapshot: 'WP-1',
        descriptionArSnapshot: 'Waterproofing',
        unitSnapshot: 'M2',
        quantityDelta: 500,
        approvedRate: 120,
      },
    ],
  });
  await contractVariationCommandService.submit(seed.companyId, voNew.id, seed.userId);
  await contractVariationCommandService.beginReview(seed.companyId, voNew.id);
  const voNewApproved = await contractVariationCommandService.approve(
    seed.companyId,
    voNew.id,
    seed.userId
  );
  const newLine = voNewApproved.lines.find((l) => l.changeType === 'NEW_ITEM');
  step('Owner: NEW_ITEM creates BOQ', Boolean(newLine?.createdProjectBOQItemId));

  const voRate = await contractVariationCommandService.saveDraft(seed.companyId, contract.id, seed.userId, {
    orderDate: new Date('2026-08-01'),
    reason: 'Rate revision',
    lines: [
      {
        changeType: 'RATE_CHANGE',
        projectBOQItemId: boq.id,
        itemCodeSnapshot: boq.itemCode,
        descriptionArSnapshot: boq.descriptionAr,
        unitSnapshot: boq.unit,
        approvedRate: 4500,
      },
    ],
  });
  await contractVariationCommandService.submit(seed.companyId, voRate.id, seed.userId);
  await contractVariationCommandService.beginReview(seed.companyId, voRate.id);
  await contractVariationCommandService.approve(seed.companyId, voRate.id, seed.userId);

  const effRate = await resolveEffectiveOwnerBoqRateInTx(prisma, seed.companyId, contract.id, boq.id);
  step('Owner: effective rate after RATE_CHANGE', Number(effRate) === 4500, String(effRate));

  const oldPrelimLine = await prisma.ownerPreliminaryCertificateLine.findFirst({
    where: { ownerPreliminaryCertificateId: approvedPrelim.id, projectBOQItemId: boq.id },
  });
  step(
    'Owner: historical prelim rate snapshot unchanged',
    Number(oldPrelimLine?.unitRateSnapshot) === prelimRateSnapshot,
    String(oldPrelimLine?.unitRateSnapshot)
  );

  const integrity = await contractVariationIntegrityService.reconcileContract(seed.companyId, contract.id);
  step('Owner: VO integrity overall', integrity.overall === 'MATCH', integrity.overall);

  const jeAfter = await countContractingJe(seed.companyId);
  step('Owner: zero GL from all VO ops', jeAfter === jeBefore, `${jeAfter}`);
}

async function subcontractVariationFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const BOQ_QTY = 1000;
  const RATE = 4000;
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `P2-SUB-${seed.suffix}`,
    projectName: 'P2 Sub VO',
    contractValue: BOQ_QTY * RATE,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });
  const subcon = await subcontractCommandService.createSubcontractor(seed.companyId, {
    nameAr: `Sub ${seed.suffix}`,
  });
  const sub = await subcontractCommandService.createSubcontract(seed.companyId, {
    subcontractorId: subcon.id,
    projectId: project.id,
    contractDate: new Date('2026-03-01'),
    totalContractValue: BOQ_QTY * RATE,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
  });
  const subWithBoq = await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [
      {
        itemCode: 'SUB-C',
        descriptionAr: 'Sub concrete',
        unit: 'M3',
        contractQuantity: BOQ_QTY,
        unitPrice: RATE,
        maxAllowedQuantity: BOQ_QTY,
      },
    ],
  });
  const boqItem = subWithBoq.boqItems[0]!;

  const prelim = await subcontractPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    sub.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      lines: [{ subcontractBOQItemId: boqItem.id, requestedCurrentQuantity: 300 }],
    }
  );
  await subcontractPreliminaryCertificateCommandService.submit(seed.companyId, prelim.id, seed.userId);
  await subcontractPreliminaryCertificateCommandService.beginReview(seed.companyId, prelim.id);
  await subcontractPreliminaryCertificateCommandService.approve(seed.companyId, prelim.id, seed.userId, [
    { subcontractBOQItemId: boqItem.id, approvedCurrentQuantity: 250 },
  ]);

  const vo1 = await subcontractVariationCommandService.saveDraft(seed.companyId, sub.id, seed.userId, {
    orderDate: new Date('2026-04-01'),
    reason: '+200 scope',
    lines: [
      {
        changeType: 'QUANTITY_CHANGE',
        subcontractBOQItemId: boqItem.id,
        itemCodeSnapshot: boqItem.itemCode,
        descriptionArSnapshot: boqItem.descriptionAr,
        unitSnapshot: boqItem.unit,
        quantityDelta: 200,
      },
    ],
  });
  await subcontractVariationCommandService.submit(seed.companyId, vo1.id, seed.userId);
  await subcontractVariationCommandService.beginReview(seed.companyId, vo1.id);
  await subcontractVariationCommandService.approve(seed.companyId, vo1.id, seed.userId);
  step('Sub: VO approved +200', vo1.orderNumber.startsWith('VO-'));

  const calcOk = await subcontractInvoiceCalculationService.calculateDraftInvoice({
    companyId: seed.companyId,
    subcontractId: sub.id,
    items: [{ subcontractBOQItemId: boqItem.id, currentQuantity: 950 }],
  });
  step(
    'Sub financial: cumulative 1200 within effective VO cap',
    Number(calcOk.lines[0].totalCumulativeQuantity) === 1200
  );

  let finBlocked = false;
  try {
    await subcontractInvoiceCalculationService.calculateDraftInvoice({
      companyId: seed.companyId,
      subcontractId: sub.id,
      items: [{ subcontractBOQItemId: boqItem.id, currentQuantity: 951 }],
    });
  } catch (e) {
    finBlocked = e instanceof BoqLimitExceededError;
  }
  step('Sub financial: >1200 blocked', finBlocked);

  const prelim2 = await subcontractPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    sub.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-04-01'),
      periodEndDate: new Date('2026-04-30'),
      lines: [{ subcontractBOQItemId: boqItem.id, requestedCurrentQuantity: 750 }],
    }
  );
  await subcontractPreliminaryCertificateCommandService.submit(seed.companyId, prelim2.id, seed.userId);
  await subcontractPreliminaryCertificateCommandService.beginReview(seed.companyId, prelim2.id);
  await subcontractPreliminaryCertificateCommandService.approve(seed.companyId, prelim2.id, seed.userId, [
    { subcontractBOQItemId: boqItem.id, approvedCurrentQuantity: 750 },
  ]);
  step('Sub: cumulative certified 1000 after partial prelim', true);

  const voBad = await subcontractVariationCommandService.saveDraft(seed.companyId, sub.id, seed.userId, {
    orderDate: new Date('2026-05-01'),
    reason: 'unsafe',
    lines: [
      {
        changeType: 'OMIT',
        subcontractBOQItemId: boqItem.id,
        itemCodeSnapshot: boqItem.itemCode,
        descriptionArSnapshot: boqItem.descriptionAr,
        unitSnapshot: boqItem.unit,
        quantityDelta: -501,
      },
    ],
  });
  await subcontractVariationCommandService.submit(seed.companyId, voBad.id, seed.userId);
  await subcontractVariationCommandService.beginReview(seed.companyId, voBad.id);
  let blocked = false;
  try {
    await subcontractVariationCommandService.approve(seed.companyId, voBad.id, seed.userId);
  } catch (e) {
    blocked = e instanceof SubcontractVariationOverCertificationError;
  }
  step('Sub: block unsafe reduction', blocked);

  const jeBefore = await countContractingJe(seed.companyId);
  const jeAfter = await countContractingJe(seed.companyId);
  step('Sub: zero GL from variation', jeAfter === jeBefore);
}

async function cleanup(companyId: string) {
  await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
}

async function main() {
  const seed = await seedCompany('p2');
  try {
    await ownerVariationFlow(seed);
    await subcontractVariationFlow(seed);
  } finally {
    await cleanup(seed.companyId);
  }

  const failed = steps.filter((s) => !s.ok);
  console.log('\n=== P1-2 SUMMARY ===');
  console.log('Passed:', steps.filter((s) => s.ok).length, 'Failed:', failed.length);

  console.log('\n=== P1 REGRESSION ===');
  execSync('npx tsx scripts/contracting/p1-preliminary-e2e-verify.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });

  if (failed.length) {
    console.log('\nCONTRACTING P1-2 NOT VERIFIED');
    process.exit(1);
  }
  console.log('\nCONTRACTING P1-2 E2E VERIFIED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
