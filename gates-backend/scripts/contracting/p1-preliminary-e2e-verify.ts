#!/usr/bin/env tsx
/**
 * P1-1 Preliminary certificates E2E (owner + subcontract) then P0 regression.
 * Usage: DATABASE_URL=mysql://.../gates_db tsx scripts/contracting/p1-preliminary-e2e-verify.ts
 */
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SYSTEM_GL_CODES } from '../../src/modules/accounting/data/system-account-map';
import { contractingProjectService } from '../../src/modules/contracting/services/contracting-project.service';
import { clientContractService } from '../../src/modules/contracting/client-billing/services/client-contract.service';
import { ownerPreliminaryCertificateCommandService } from '../../src/modules/contracting/preliminary/owner-preliminary-certificate-command.service';
import { subcontractPreliminaryCertificateCommandService } from '../../src/modules/contracting/preliminary/subcontract-preliminary-certificate-command.service';
import { preliminaryCertificateIntegrityService } from '../../src/modules/contracting/preliminary/preliminary-certificate-integrity.service';
import { ClientBoqLimitExceededError } from '../../src/modules/contracting/client-billing/errors/client-billing-domain.errors';
import { BoqLimitExceededError } from '../../src/modules/subcontracts/errors/subcontract-domain.errors';
import { subcontractCommandService } from '../../src/modules/subcontracts/services/subcontract-command.service';
const prisma = new PrismaClient();

type StepResult = { name: string; ok: boolean; detail?: string };
const steps: StepResult[] = [];

function idemKey(label = 'p1'): string {
  return `${label}-${randomUUID()}`;
}

function step(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
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
    data: { arabicName: `P1 Prelim ${suffix}`, isActive: true },
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
      email: `p1-${suffix}@example.local`,
      username: `p1${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      passwordHash: 'test',
      firstName: 'P1',
      lastName: 'Prelim',
    },
  });

  return { companyId: company.id, branchId: branch.id, userId: user.id, suffix };
}

async function countContractingJe(companyId: string) {
  return prisma.journalEntry.count({
    where: {
      companyId,
      sourceType: { in: ['CLIENT_INVOICE', 'SUBCONTRACT_INVOICE'] },
    },
  });
}

async function ownerPreliminaryFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const BOQ_QTY = 1000;
  const RATE = 4000;

  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `P1-OWN-${seed.suffix}`,
    projectName: 'P1 Owner Prelim',
    contractValue: BOQ_QTY * RATE,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });

  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'EARTH-1',
      descriptionAr: 'Earthworks',
      unit: 'M3',
      contractQuantity: new Decimal(BOQ_QTY),
      unitSellingPrice: new Decimal(RATE),
      totalSellingPrice: new Decimal(BOQ_QTY * RATE),
      status: 'APPROVED_IN_CONTRACT',
    },
  });

  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `CC-P1-${seed.suffix}`,
    clientCustomerId: (
      await prisma.customer.create({
        data: {
          companyId: seed.companyId,
          arabicName: `Cust ${seed.suffix}`,
          creditLimit: 9_999_999,
          priceTier: 'RETAIL',
        },
      })
    ).id,
    contractDate: new Date('2026-03-01'),
    totalContractValue: BOQ_QTY * RATE,
    advancePaymentAmount: 0,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });

  const jeBefore = await countContractingJe(seed.companyId);

  const prelim1 = await ownerPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    contract.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      lines: [{ projectBOQItemId: boq.id, requestedCurrentQuantity: 400 }],
    }
  );
  await ownerPreliminaryCertificateCommandService.submit(seed.companyId, prelim1.id, seed.userId);
  await ownerPreliminaryCertificateCommandService.beginReview(seed.companyId, prelim1.id);
  const approved1 = await ownerPreliminaryCertificateCommandService.approve(
    seed.companyId,
    prelim1.id,
    seed.userId,
    [{ projectBOQItemId: boq.id, approvedCurrentQuantity: 380 }]
  );

  assertClose(Number(approved1.lines[0].approvedCurrentQuantity), 380, 'prelim1 approved qty');
  assertClose(Number(approved1.grossCurrentWorks), 380 * RATE, 'prelim1 gross');

  const jeAfterApprove = await countContractingJe(seed.companyId);
  step('Owner: zero certificate GL through approve', jeAfterApprove === jeBefore, `${jeAfterApprove}`);

  const prelim2 = await ownerPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    contract.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-04-01'),
      periodEndDate: new Date('2026-04-30'),
      lines: [{ projectBOQItemId: boq.id, requestedCurrentQuantity: 620 }],
    }
  );
  await ownerPreliminaryCertificateCommandService.submit(seed.companyId, prelim2.id, seed.userId);
  await ownerPreliminaryCertificateCommandService.beginReview(seed.companyId, prelim2.id);
  const approved2 = await ownerPreliminaryCertificateCommandService.approve(
    seed.companyId,
    prelim2.id,
    seed.userId,
    [{ projectBOQItemId: boq.id, approvedCurrentQuantity: 620 }]
  );
  assertClose(
    Number(approved2.lines[0].cumulativeApprovedQuantity),
    1000,
    'prelim2 cumulative qty'
  );

  let blocked = false;
  try {
    await ownerPreliminaryCertificateCommandService.saveDraft(seed.companyId, contract.id, seed.userId, {
      periodStartDate: new Date('2026-05-01'),
      periodEndDate: new Date('2026-05-31'),
      lines: [{ projectBOQItemId: boq.id, requestedCurrentQuantity: 1 }],
    });
  } catch (e) {
    blocked = e instanceof ClientBoqLimitExceededError;
  }
  step('Owner: block cumulative over 1000', blocked, '');

  const convertKey = idemKey('owner-convert');
  const c1 = await ownerPreliminaryCertificateCommandService.convertToClientInvoice(
    seed.companyId,
    approved1.id,
    seed.userId,
    convertKey
  );
  const c2 = await ownerPreliminaryCertificateCommandService.convertToClientInvoice(
    seed.companyId,
    approved1.id,
    seed.userId,
    convertKey
  );
  step(
    'Owner: convert idempotent',
    c1.clientInvoiceId === c2.clientInvoiceId && (c2.replay || c1.replay),
    `invoice=${c1.clientInvoiceId}`
  );

  const integrity = await preliminaryCertificateIntegrityService.checkOwner(seed.companyId, approved1.id);
  step('Owner: integrity MATCH after convert', integrity.overall === 'MATCH', integrity.overall);

  const jeAfterConvert = await countContractingJe(seed.companyId);
  step('Owner: still zero GL on draft convert', jeAfterConvert === jeBefore, `${jeAfterConvert}`);

  return { contractId: contract.id, prelim1Id: approved1.id };
}

async function subcontractPreliminaryFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const BOQ_QTY = 1000;
  const RATE = 4000;

  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `P1-SUB-${seed.suffix}`,
    projectName: 'P1 Sub Prelim',
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
  await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [
      {
        itemCode: 'SUB-1',
        descriptionAr: 'Sub works',
        unit: 'M3',
        contractQuantity: BOQ_QTY,
        unitPrice: RATE,
        maxAllowedQuantity: BOQ_QTY,
      },
    ],
  });
  const subDetail = await subcontractCommandService.getSubcontract(seed.companyId, sub.id);
  const boqId = subDetail.boqItems[0].id;

  const jeBefore = await countContractingJe(seed.companyId);

  const prelim1 = await subcontractPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    sub.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      lines: [{ subcontractBOQItemId: boqId, requestedCurrentQuantity: 400 }],
    }
  );
  await subcontractPreliminaryCertificateCommandService.submit(seed.companyId, prelim1.id, seed.userId);
  await subcontractPreliminaryCertificateCommandService.beginReview(seed.companyId, prelim1.id);
  const approved1 = await subcontractPreliminaryCertificateCommandService.approve(
    seed.companyId,
    prelim1.id,
    seed.userId,
    [{ subcontractBOQItemId: boqId, approvedCurrentQuantity: 380 }]
  );
  assertClose(Number(approved1.grossCurrentAmount), 380 * RATE, 'sub prelim1 gross');

  const prelim2 = await subcontractPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    sub.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-04-01'),
      periodEndDate: new Date('2026-04-30'),
      lines: [{ subcontractBOQItemId: boqId, requestedCurrentQuantity: 620 }],
    }
  );
  await subcontractPreliminaryCertificateCommandService.submit(seed.companyId, prelim2.id, seed.userId);
  await subcontractPreliminaryCertificateCommandService.beginReview(seed.companyId, prelim2.id);
  await subcontractPreliminaryCertificateCommandService.approve(seed.companyId, prelim2.id, seed.userId, [
    { subcontractBOQItemId: boqId, approvedCurrentQuantity: 620 },
  ]);

  let blocked = false;
  try {
    await subcontractPreliminaryCertificateCommandService.saveDraft(seed.companyId, sub.id, seed.userId, {
      periodStartDate: new Date('2026-05-01'),
      periodEndDate: new Date('2026-05-31'),
      lines: [{ subcontractBOQItemId: boqId, requestedCurrentQuantity: 1 }],
    });
  } catch (e) {
    blocked = e instanceof BoqLimitExceededError;
  }
  step('Sub: block cumulative over max', blocked, '');

  const convertKey = idemKey('sub-convert');
  const c1 = await subcontractPreliminaryCertificateCommandService.convertToSubcontractInvoice(
    seed.companyId,
    approved1.id,
    seed.userId,
    convertKey
  );
  const c2 = await subcontractPreliminaryCertificateCommandService.convertToSubcontractInvoice(
    seed.companyId,
    approved1.id,
    seed.userId,
    convertKey
  );
  step(
    'Sub: convert idempotent',
    c1.subcontractInvoiceId === c2.subcontractInvoiceId && (c2.replay || c1.replay),
    `invoice=${c1.subcontractInvoiceId}`
  );

  const integrity = await preliminaryCertificateIntegrityService.checkSubcontract(
    seed.companyId,
    approved1.id
  );
  step('Sub: integrity MATCH after convert', integrity.overall === 'MATCH', integrity.overall);

  const jeAfter = await countContractingJe(seed.companyId);
  step('Sub: zero GL through convert draft', jeAfter === jeBefore, `${jeAfter}`);

  const rejectTarget = await subcontractPreliminaryCertificateCommandService.saveDraft(
    seed.companyId,
    sub.id,
    seed.userId,
    {
      periodStartDate: new Date('2026-06-01'),
      periodEndDate: new Date('2026-06-30'),
      lines: [{ subcontractBOQItemId: boqId, requestedCurrentQuantity: 0 }],
    }
  );
  await subcontractPreliminaryCertificateCommandService.submit(
    seed.companyId,
    rejectTarget.id,
    seed.userId
  );
  await subcontractPreliminaryCertificateCommandService.beginReview(seed.companyId, rejectTarget.id);
  await subcontractPreliminaryCertificateCommandService.reject(
    seed.companyId,
    rejectTarget.id,
    seed.userId,
    'test reject from review'
  );
  const rejected = await subcontractPreliminaryCertificateCommandService.get(seed.companyId, rejectTarget.id);
  step('Sub: reject allowed from UNDER_REVIEW', rejected.status === 'REJECTED', rejected.status);
}

async function cleanup(companyId: string) {
  await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
}

async function main() {
  const seed = await seedCompany('p1');
  try {
    await ownerPreliminaryFlow(seed);
    await subcontractPreliminaryFlow(seed);
  } finally {
    await cleanup(seed.companyId);
  }

  const failed = steps.filter((s) => !s.ok);
  console.log('\n=== P1 SUMMARY ===');
  console.log('Passed:', steps.filter((s) => s.ok).length, 'Failed:', failed.length);

  console.log('\n=== P0 REGRESSION ===');
  execSync('npx tsx scripts/contracting/p0-e2e-verify.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });

  if (failed.length) {
    console.log('\nCONTRACTING P1-1 NOT VERIFIED');
    process.exit(1);
  }
  console.log('\nCONTRACTING P1-1 E2E VERIFIED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
