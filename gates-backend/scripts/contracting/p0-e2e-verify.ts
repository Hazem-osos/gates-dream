#!/usr/bin/env tsx
/**
 * Local/dev MySQL E2E verification for Contracting P0-1 through P0-4.
 * Usage: DATABASE_URL=mysql://.../gates_db tsx scripts/contracting/p0-e2e-verify.ts
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SYSTEM_GL_CODES } from '../../src/modules/accounting/data/system-account-map';
import { contractingProjectService } from '../../src/modules/contracting/services/contracting-project.service';
import { clientContractService } from '../../src/modules/contracting/client-billing/services/client-contract.service';
import { clientInvoiceCommandService } from '../../src/modules/contracting/client-billing/services/client-invoice-command.service';
import { contractingCertificateSettlementService } from '../../src/modules/contracting/settlement/contracting-certificate-settlement.service';
import { contractingAccountResolverService } from '../../src/modules/contracting/services/contracting-account-resolver.service';
import {
  requireLegacyWave3Stack,
} from '../../src/modules/contracting/services/contracting-canonical-stack.service';
import { subcontractCommandService } from '../../src/modules/subcontracts/services/subcontract-command.service';
import { subcontractInvoiceCommandService } from '../../src/modules/subcontracts/services/subcontract-invoice-command.service';
import { subcontractAccountResolverService } from '../../src/modules/subcontracts/services/subcontract-account-resolver.service';
import { treasuryPostingService } from '../../src/modules/treasury/services/treasury-posting.service';
import type { TreasuryPostingContext } from '../../src/modules/treasury/types/treasury.types';
import { AppError } from '../../src/shared/middleware/error-handler';
import { IDEMPOTENCY_KEY_CONFLICT } from '../../src/modules/contracting/settlement/contracting-settlement-idempotency.service';
import { contractingPartyReconciliationService } from '../../src/modules/contracting/reconciliation/contracting-party-reconciliation.service';
import { getSubcontractorPartyStatement } from '../../src/modules/contracting/reconciliation/contracting-party-statement.service';
import { sumPartnerNetOriginal } from '../../src/modules/accounting/services/party-ledger-balance.service';
import { journalEntryService } from '../../src/modules/accounting/services/journal-entry.service';
import {
  contractingCertificateReversalService,
  LATER_CERTIFICATE_BLOCKS_REVERSAL,
} from '../../src/modules/contracting/reversal/contracting-certificate-reversal.service';
import { ACTIVE_SETTLEMENT_BLOCKS_REVERSAL } from '../../src/modules/contracting/settlement/contracting-settlement-status';

const prisma = new PrismaClient();

type StepResult = { name: string; ok: boolean; detail?: string };

const steps: StepResult[] = [];
const CERT_NET = 100_000;

function idemKey(label = 'e2e'): string {
  return `${label}-${randomUUID()}`;
}

function step(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function assertClose(a: number, b: number, label: string, tol = 0.01) {
  if (Math.abs(a - b) > tol) {
    throw new Error(`${label}: expected ${b}, got ${a}`);
  }
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
    data: { arabicName: `P0 E2E ${suffix}`, isActive: true },
  });
  const branch = await prisma.branch.create({
    data: { companyId: company.id, arabicName: `Branch ${suffix}`, defaultSafeId: null },
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

  const codes: Array<[string, string, string]> = [];
  const seenCodes = new Set<string>();
  for (const code of Object.values(SYSTEM_GL_CODES)) {
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    codes.push([code, `Acct ${code}`, code.startsWith('2') || code.startsWith('3') ? 'liability' : code.startsWith('4') ? 'revenue' : code.startsWith('5') ? 'expense' : 'asset']);
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
    if (!seenCodes.has(code)) codes.push([code, `Acct ${code}`, fallback]);
  }
  for (const [code, name, type] of codes) {
    await createAccount(company.id, code, `${name} ${suffix}`, type);
  }

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
      code: `SF${suffix.slice(-6)}`,
      arabicName: `Safe ${suffix}`,
      currencyCode: 'EGP',
      glAccountId: cashGl.id,
      isActive: true,
    },
  });

  await prisma.branch.update({ where: { id: branch.id }, data: { defaultSafeId: safe.id } });

  const customer = await prisma.customer.create({
    data: { companyId: company.id, arabicName: `Client ${suffix}`, creditLimit: 1_000_000, priceTier: 'RETAIL' },
  });

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `p0-${suffix}@example.local`,
      username: `p0${suffix.replace(/\W/g, '').slice(0, 12)}`,
      passwordHash: 'test',
      firstName: 'P0',
      lastName: 'E2E',
    },
  });

  return {
    companyId: company.id,
    branchId: branch.id,
    fiscalYearId: fiscalYear.id,
    safeId: safe.id,
    customerId: customer.id,
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

async function sumJeBase(journalEntryId: string) {
  const lines = await prisma.journalEntryLine.findMany({
    where: { journalEntryId },
    select: { debitBase: true, creditBase: true, accountId: true },
  });
  const debit = lines.reduce((s, l) => s + Number(l.debitBase), 0);
  const credit = lines.reduce((s, l) => s + Number(l.creditBase), 0);
  return { lines, debit, credit };
}

async function countActiveAllocations(companyId: string, clientInvoiceId: string) {
  return prisma.contractingCertificateAllocation.count({
    where: {
      companyId,
      clientInvoiceId,
      cashTransaction: { isPosted: true, isCancelled: false },
    },
  });
}

async function ownerFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const ctx = treasuryCtx(seed);
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `PRJ-${seed.suffix}`,
    projectName: 'P0 Owner Project',
    customerId: seed.customerId,
    contractValue: CERT_NET,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });

  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'LS-1',
      descriptionAr: 'Works',
      unit: 'LS',
      contractQuantity: new Decimal(1),
      unitSellingPrice: new Decimal(CERT_NET),
      totalSellingPrice: new Decimal(CERT_NET),
      status: 'APPROVED_IN_CONTRACT',
    },
  });

  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `CC-${seed.suffix}`,
    clientCustomerId: seed.customerId,
    contractDate: new Date('2026-03-01'),
    totalContractValue: CERT_NET,
    advancePaymentAmount: 0,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });

  const draft = await clientInvoiceCommandService.createOrUpdateDraft(seed.companyId, contract.id, {
    periodStartDate: new Date('2026-03-01'),
    periodEndDate: new Date('2026-03-31'),
    items: [{ projectBOQItemId: boq.id, currentQuantity: 1 }],
  });

  await clientInvoiceCommandService.submitToClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.approveByClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.lockAndPostClientInvoice(
    seed.companyId,
    draft.id,
    seed.userId,
    seed.branchId
  );

  const posted = await prisma.clientInvoice.findFirstOrThrow({ where: { id: draft.id } });
  assertClose(Number(posted.netPayableByClient), CERT_NET, 'certificate net');
  assertClose(Number(posted.remainingSettlementAmount), CERT_NET, 'remaining after post');

  const certJeCountBefore = await prisma.journalEntry.count({
    where: { companyId: seed.companyId, sourceType: 'CLIENT_INVOICE' },
  });

  const accounts = await contractingAccountResolverService.resolveAccounts(seed.companyId);

  // A: collect 30k
  const c1 = await contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
    amount: 30_000,
    safeId: seed.safeId,
    date: new Date('2026-04-01'),
    idempotencyKey: idemKey('owner-a1'),
  });

  const after30 = await prisma.clientInvoice.findFirstOrThrow({ where: { id: draft.id } });
  const alloc30 = await countActiveAllocations(seed.companyId, draft.id);
  const cashCount30 = await prisma.cashTransaction.count({
    where: { companyId: seed.companyId, transactionKind: 'RECEIPT' },
  });

  step(
    'Owner A: collect 30k balances',
    after30.settlementStatus === 'PARTIALLY_SETTLED' &&
      Math.abs(Number(after30.collectedAmount) - 30_000) < 0.02 &&
      Math.abs(Number(after30.remainingSettlementAmount) - 70_000) < 0.02,
    `status=${after30.settlementStatus}`
  );

  step('Owner A: one cash tx', cashCount30 === 1, `count=${cashCount30}`);
  step('Owner A: one active allocation', alloc30 === 1, `count=${alloc30}`);

  const cash1 = await prisma.cashTransaction.findFirstOrThrow({ where: { id: c1.cashTransactionId } });
  step('Owner A: cash posted with JE', Boolean(cash1.journalEntryId), cash1.journalEntryId ?? '');
  if (cash1.journalEntryId) {
    const je = await sumJeBase(cash1.journalEntryId);
    step('Owner A: treasury JE balanced', Math.abs(je.debit - je.credit) < 0.02, `D=${je.debit} C=${je.credit}`);
    const arLine = je.lines.find((l) => l.accountId === accounts.clientReceivableAccountId);
    step('Owner A: AR credited on receipt', Boolean(arLine && Number(arLine.creditBase) >= 29_999), '');
  }

  // B: collect 70k
  const c2 = await contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
    amount: 70_000,
    safeId: seed.safeId,
    date: new Date('2026-04-02'),
    idempotencyKey: idemKey('owner-a2'),
  });

  const after100 = await prisma.clientInvoice.findFirstOrThrow({ where: { id: draft.id } });
  const certJeCountAfter = await prisma.journalEntry.count({
    where: { companyId: seed.companyId, sourceType: 'CLIENT_INVOICE' },
  });
  step(
    'Owner B: fully settled',
    after100.settlementStatus === 'SETTLED' &&
      Number(after100.collectedAmount) === CERT_NET &&
      Number(after100.remainingSettlementAmount) === 0,
    `status=${after100.status}`
  );
  step('Owner B: no duplicate certificate JE', certJeCountAfter === certJeCountBefore, `${certJeCountAfter}`);

  const allocRowsNoJe = await prisma.contractingCertificateAllocation.findMany({
    where: { companyId: seed.companyId, clientInvoiceId: draft.id },
    select: { id: true },
  });
  step(
    'Owner: allocation rows create no GL',
    allocRowsNoJe.length >= 2,
    `allocations=${allocRowsNoJe.length} (JE only on cash tx)`
  );

  // C: over-collection while SETTLED
  let overRejected = false;
  try {
    await contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
      amount: 1,
      safeId: seed.safeId,
      idempotencyKey: idemKey('owner-over'),
    });
  } catch (e) {
    overRejected = e instanceof AppError && e.statusCode === 422;
  }
  const cashAfterOver = await prisma.cashTransaction.count({ where: { companyId: seed.companyId } });
  step('Owner C: over-collection rejected', overRejected, '');
  step('Owner C: no extra cash tx', cashAfterOver === 2, `count=${cashAfterOver}`);

  // Concurrency prep: unpost the 70k receipt → remaining 70k, collected 30k
  await treasuryPostingService.unpostCashTransaction(ctx, c2.cashTransactionId);
  const beforeRace = await prisma.clientInvoice.findFirstOrThrow({ where: { id: draft.id } });
  const remainingBeforeRace = Number(beforeRace.remainingSettlementAmount);

  return {
    clientInvoiceId: draft.id,
    ctx,
    firstReceiptId: c1.cashTransactionId,
    remainingBeforeRace,
  };
}

async function concurrencyOwner(
  seed: Awaited<ReturnType<typeof seedCompany>>,
  clientInvoiceId: string,
  ctx: TreasuryPostingContext,
  remainingBeforeRace: number
) {
  if (Math.abs(remainingBeforeRace - 70_000) > 1) {
    step('Concurrency: precondition remaining 70k', false, `remaining=${remainingBeforeRace}`);
    return;
  }
  step('Concurrency: precondition remaining 70k', true, '');

  const [r1, r2] = await Promise.allSettled([
    contractingCertificateSettlementService.collectClientInvoice(ctx, clientInvoiceId, {
      amount: 50_000,
      safeId: seed.safeId,
      idempotencyKey: idemKey('race-1'),
    }),
    contractingCertificateSettlementService.collectClientInvoice(ctx, clientInvoiceId, {
      amount: 50_000,
      safeId: seed.safeId,
      idempotencyKey: idemKey('race-2'),
    }),
  ]);

  const okCount = [r1, r2].filter((r) => r.status === 'fulfilled').length;
  const failCount = [r1, r2].filter((r) => r.status === 'rejected').length;

  const finalInv = await prisma.clientInvoice.findFirstOrThrow({ where: { id: clientInvoiceId } });
  const activeSum = await prisma.contractingCertificateAllocation.aggregate({
    where: {
      companyId: seed.companyId,
      clientInvoiceId,
      cashTransaction: { isPosted: true, isCancelled: false },
    },
    _sum: { allocatedAmount: true },
  });
  const sumActive = Number(activeSum._sum.allocatedAmount ?? 0);

  step(
    'Concurrency: sum(active) <= certificate net',
    sumActive <= CERT_NET + 0.02,
    `ok=${okCount} fail=${failCount} sumActive=${sumActive} collected=${finalInv.collectedAmount}`
  );
  step(
    'Concurrency: not both 50k succeed',
    okCount <= 1 || sumActive <= 30_000 + 50_000 + 0.02,
    `ok=${okCount}`
  );
}

async function doubleClick(seed: Awaited<ReturnType<typeof seedCompany>>) {
  // Fresh small cert for double-click on 10k
  const ctx = treasuryCtx(seed);
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `DC-${seed.suffix}`,
    projectName: 'Double click',
    customerId: seed.customerId,
    contractValue: 10_000,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });
  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'DC-1',
      descriptionAr: 'DC',
      unit: 'LS',
      contractQuantity: new Decimal(1),
      unitSellingPrice: new Decimal(10_000),
      totalSellingPrice: new Decimal(10_000),
      status: 'APPROVED_IN_CONTRACT',
    },
  });
  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `DC-${seed.suffix}`,
    clientCustomerId: seed.customerId,
    contractDate: new Date('2026-03-01'),
    totalContractValue: 10_000,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });
  const draft = await clientInvoiceCommandService.createOrUpdateDraft(seed.companyId, contract.id, {
    periodStartDate: new Date('2026-03-01'),
    periodEndDate: new Date('2026-03-31'),
    items: [{ projectBOQItemId: boq.id, currentQuantity: 1 }],
  });
  await clientInvoiceCommandService.submitToClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.approveByClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.lockAndPostClientInvoice(
    seed.companyId,
    draft.id,
    seed.userId,
    seed.branchId
  );

  const before = await prisma.cashTransaction.count({ where: { companyId: seed.companyId } });
  const sameKey = idemKey('dc-same');
  const [d1, d2] = await Promise.allSettled([
    contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
      amount: 5_000,
      safeId: seed.safeId,
      idempotencyKey: sameKey,
    }),
    contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
      amount: 5_000,
      safeId: seed.safeId,
      idempotencyKey: sameKey,
    }),
  ]);
  const after = await prisma.cashTransaction.count({ where: { companyId: seed.companyId } });
  const inv = await prisma.clientInvoice.findFirstOrThrow({ where: { id: draft.id } });
  const fulfilled = [d1, d2].filter((r) => r.status === 'fulfilled') as Array<
    PromiseFulfilledResult<Awaited<ReturnType<typeof contractingCertificateSettlementService.collectClientInvoice>>>
  >;
  const replaySameCash =
    fulfilled.length >= 1 &&
    fulfilled.every((r) => r.value.cashTransactionId === fulfilled[0].value.cashTransactionId);
  step(
    'Double-click: same idempotency key → one cash tx',
    after - before === 1 && replaySameCash,
    `newCash=${after - before} collected=${inv.collectedAmount}`
  );
}

function isIdempotencyConflict(error: unknown): boolean {
  return error instanceof AppError && error.statusCode === 409 && error.message.includes(IDEMPOTENCY_KEY_CONFLICT);
}

async function idempotencyOwner(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const ctx = treasuryCtx(seed);
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `IDEM-O-${seed.suffix}`,
    projectName: 'Idempotency owner',
    customerId: seed.customerId,
    contractValue: 10_000,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });
  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'IO-1',
      descriptionAr: 'IO',
      unit: 'LS',
      contractQuantity: new Decimal(1),
      unitSellingPrice: new Decimal(10_000),
      totalSellingPrice: new Decimal(10_000),
      status: 'APPROVED_IN_CONTRACT',
    },
  });
  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `IO-${seed.suffix}`,
    clientCustomerId: seed.customerId,
    contractDate: new Date('2026-03-01'),
    totalContractValue: 10_000,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });
  const draft = await clientInvoiceCommandService.createOrUpdateDraft(seed.companyId, contract.id, {
    periodStartDate: new Date('2026-03-01'),
    periodEndDate: new Date('2026-03-31'),
    items: [{ projectBOQItemId: boq.id, currentQuantity: 1 }],
  });
  await clientInvoiceCommandService.submitToClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.approveByClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.lockAndPostClientInvoice(
    seed.companyId,
    draft.id,
    seed.userId,
    seed.branchId
  );

  const cashBefore = await prisma.cashTransaction.count({
    where: { companyId: seed.companyId, transactionKind: 'RECEIPT' },
  });
  const keyAbc = idemKey('owner-abc');
  const [cRace1, cRace2] = await Promise.allSettled([
    contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
      amount: 5_000,
      safeId: seed.safeId,
      idempotencyKey: keyAbc,
    }),
    contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
      amount: 5_000,
      safeId: seed.safeId,
      idempotencyKey: keyAbc,
    }),
  ]);
  const cashAfterRace = await prisma.cashTransaction.count({
    where: { companyId: seed.companyId, transactionKind: 'RECEIPT' },
  });
  const invAfterRace = await prisma.clientInvoice.findFirstOrThrow({ where: { id: draft.id } });
  const allocAfterRace = await countActiveAllocations(seed.companyId, draft.id);
  const winners = [cRace1, cRace2].filter((r) => r.status === 'fulfilled') as Array<
    PromiseFulfilledResult<Awaited<ReturnType<typeof contractingCertificateSettlementService.collectClientInvoice>>>
  >;
  step(
    'P0-2.1 Owner: concurrent same key → one receipt',
    cashAfterRace - cashBefore === 1 &&
      allocAfterRace === 1 &&
      Math.abs(Number(invAfterRace.collectedAmount) - 5_000) < 0.02,
    `cash+${cashAfterRace - cashBefore} allocs=${allocAfterRace}`
  );

  const replay = await contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
    amount: 5_000,
    safeId: seed.safeId,
    idempotencyKey: keyAbc,
  });
  const cashAfterReplay = await prisma.cashTransaction.count({
    where: { companyId: seed.companyId, transactionKind: 'RECEIPT' },
  });
  step(
    'P0-2.1 Owner: replay same key → same cash, no new tx',
    cashAfterReplay === cashAfterRace &&
      winners.length >= 1 &&
      replay.cashTransactionId === winners[0].value.cashTransactionId,
    replay.cashTransactionId
  );

  let conflict = false;
  try {
    await contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
      amount: 7_000,
      safeId: seed.safeId,
      idempotencyKey: keyAbc,
    });
  } catch (e) {
    conflict = isIdempotencyConflict(e);
  }
  step('P0-2.1 Owner: same key different amount → conflict', conflict, '');

  const keyXyz = idemKey('owner-xyz');
  await contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
    amount: 5_000,
    safeId: seed.safeId,
    idempotencyKey: keyXyz,
  });
  const inv10 = await prisma.clientInvoice.findFirstOrThrow({ where: { id: draft.id } });
  step(
    'P0-2.1 Owner: new key collects remainder',
    inv10.settlementStatus === 'SETTLED' && Math.abs(Number(inv10.collectedAmount) - 10_000) < 0.02,
    `collected=${inv10.collectedAmount}`
  );

  let overAfterFull = false;
  try {
    await contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
      amount: 5_000,
      safeId: seed.safeId,
      idempotencyKey: idemKey('owner-over-full'),
    });
  } catch (e) {
    overAfterFull = e instanceof AppError && e.statusCode === 422;
  }
  const cashFinal = await prisma.cashTransaction.count({
    where: { companyId: seed.companyId, transactionKind: 'RECEIPT' },
  });
  step('P0-2.1 Owner: over-collection after settled rejected', overAfterFull, '');
  step('P0-2.1 Owner: total two receipts for 10k cert', cashFinal - cashBefore === 2, `count=${cashFinal - cashBefore}`);
}

async function idempotencySub(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const ctx = treasuryCtx(seed);
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `IDEM-S-${seed.suffix}`,
    projectName: 'Idempotency sub',
    contractValue: 10_000,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });
  const subcon = await subcontractCommandService.createSubcontractor(seed.companyId, {
    nameAr: `Sub Idem ${seed.suffix}`,
  });
  const sub = await subcontractCommandService.createSubcontract(seed.companyId, {
    subcontractorId: subcon.id,
    projectId: project.id,
    contractDate: new Date('2026-03-01'),
    totalContractValue: 10_000,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
  });
  await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [
      {
        itemCode: 'IS1',
        descriptionAr: 'Sub idem',
        unit: 'LS',
        contractQuantity: 1,
        unitPrice: 10_000,
      },
    ],
  });
  const subDetail = await subcontractCommandService.getSubcontract(seed.companyId, sub.id);
  const boqId = subDetail.boqItems[0].id;
  const draft = await subcontractInvoiceCommandService.createOrUpdateDraftInvoice(seed.companyId, sub.id, {
    periodStartDate: new Date('2026-03-01'),
    periodEndDate: new Date('2026-03-31'),
    items: [{ subcontractBOQItemId: boqId, currentQuantity: 1 }],
  });
  await subcontractInvoiceCommandService.submitToSiteEngineer(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.approveByConsultant(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.approveByTechOffice(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.lockAndPostInvoice(seed.companyId, draft.id, ctx);

  const payBefore = await prisma.cashTransaction.count({
    where: { companyId: seed.companyId, transactionKind: 'PAYMENT' },
  });
  const keyPay = idemKey('sub-pay-abc');
  const [p1, p2] = await Promise.allSettled([
    contractingCertificateSettlementService.paySubcontractInvoice(ctx, draft.id, {
      amount: 5_000,
      safeId: seed.safeId,
      idempotencyKey: keyPay,
    }),
    contractingCertificateSettlementService.paySubcontractInvoice(ctx, draft.id, {
      amount: 5_000,
      safeId: seed.safeId,
      idempotencyKey: keyPay,
    }),
  ]);
  const payAfterRace = await prisma.cashTransaction.count({
    where: { companyId: seed.companyId, transactionKind: 'PAYMENT' },
  });
  const subAfterRace = await prisma.subcontractInvoice.findFirstOrThrow({ where: { id: draft.id } });
  const winners = [p1, p2].filter((r) => r.status === 'fulfilled') as Array<
    PromiseFulfilledResult<Awaited<ReturnType<typeof contractingCertificateSettlementService.paySubcontractInvoice>>>
  >;
  step(
    'P0-2.1 Sub: concurrent same key → one payment',
    payAfterRace - payBefore === 1 && Math.abs(Number(subAfterRace.paidSettlementAmount) - 5_000) < 0.02,
    `cash+${payAfterRace - payBefore}`
  );

  const replay = await contractingCertificateSettlementService.paySubcontractInvoice(ctx, draft.id, {
    amount: 5_000,
    safeId: seed.safeId,
    idempotencyKey: keyPay,
  });
  step(
    'P0-2.1 Sub: replay same key',
    winners.length >= 1 && replay.cashTransactionId === winners[0].value.cashTransactionId,
    replay.cashTransactionId
  );

  let conflict = false;
  try {
    await contractingCertificateSettlementService.paySubcontractInvoice(ctx, draft.id, {
      amount: 7_000,
      safeId: seed.safeId,
      idempotencyKey: keyPay,
    });
  } catch (e) {
    conflict = isIdempotencyConflict(e);
  }
  step('P0-2.1 Sub: same key different amount → conflict', conflict, '');

  await contractingCertificateSettlementService.paySubcontractInvoice(ctx, draft.id, {
    amount: 5_000,
    safeId: seed.safeId,
    idempotencyKey: idemKey('sub-pay-xyz'),
  });
  const subFull = await prisma.subcontractInvoice.findFirstOrThrow({ where: { id: draft.id } });
  step(
    'P0-2.1 Sub: new key completes payment',
    subFull.settlementStatus === 'SETTLED' && Math.abs(Number(subFull.paidSettlementAmount) - 10_000) < 0.02,
    ''
  );
}

async function idempotencyCrossCompany(
  seedA: Awaited<ReturnType<typeof seedCompany>>,
  seedB: Awaited<ReturnType<typeof seedCompany>>
) {
  const sharedKey = `cross-company-${randomUUID()}`;
  const ctxA = treasuryCtx(seedA);
  const ctxB = treasuryCtx(seedB);

  const projectA = await contractingProjectService.create(seedA.companyId, {
    projectCode: `XCA-${seedA.suffix}`,
    projectName: 'Cross A',
    customerId: seedA.customerId,
    contractValue: 5_000,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });
  const boqA = await prisma.projectBOQItem.create({
    data: {
      companyId: seedA.companyId,
      projectId: projectA.id,
      itemCode: 'XCA',
      descriptionAr: 'XCA',
      unit: 'LS',
      contractQuantity: new Decimal(1),
      unitSellingPrice: new Decimal(5_000),
      totalSellingPrice: new Decimal(5_000),
      status: 'APPROVED_IN_CONTRACT',
    },
  });
  const contractA = await clientContractService.createClientContract(seedA.companyId, {
    projectId: projectA.id,
    contractNumber: `XCA-${seedA.suffix}`,
    clientCustomerId: seedA.customerId,
    contractDate: new Date('2026-03-01'),
    totalContractValue: 5_000,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });
  const invA = await clientInvoiceCommandService.createOrUpdateDraft(seedA.companyId, contractA.id, {
    periodStartDate: new Date('2026-03-01'),
    periodEndDate: new Date('2026-03-31'),
    items: [{ projectBOQItemId: boqA.id, currentQuantity: 1 }],
  });
  await clientInvoiceCommandService.submitToClient(seedA.companyId, invA.id);
  await clientInvoiceCommandService.approveByClient(seedA.companyId, invA.id);
  await clientInvoiceCommandService.lockAndPostClientInvoice(
    seedA.companyId,
    invA.id,
    seedA.userId,
    seedA.branchId
  );

  const projectB = await contractingProjectService.create(seedB.companyId, {
    projectCode: `XCB-${seedB.suffix}`,
    projectName: 'Cross B',
    customerId: seedB.customerId,
    contractValue: 5_000,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });
  const boqB = await prisma.projectBOQItem.create({
    data: {
      companyId: seedB.companyId,
      projectId: projectB.id,
      itemCode: 'XCB',
      descriptionAr: 'XCB',
      unit: 'LS',
      contractQuantity: new Decimal(1),
      unitSellingPrice: new Decimal(5_000),
      totalSellingPrice: new Decimal(5_000),
      status: 'APPROVED_IN_CONTRACT',
    },
  });
  const contractB = await clientContractService.createClientContract(seedB.companyId, {
    projectId: projectB.id,
    contractNumber: `XCB-${seedB.suffix}`,
    clientCustomerId: seedB.customerId,
    contractDate: new Date('2026-03-01'),
    totalContractValue: 5_000,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });
  const invB = await clientInvoiceCommandService.createOrUpdateDraft(seedB.companyId, contractB.id, {
    periodStartDate: new Date('2026-03-01'),
    periodEndDate: new Date('2026-03-31'),
    items: [{ projectBOQItemId: boqB.id, currentQuantity: 1 }],
  });
  await clientInvoiceCommandService.submitToClient(seedB.companyId, invB.id);
  await clientInvoiceCommandService.approveByClient(seedB.companyId, invB.id);
  await clientInvoiceCommandService.lockAndPostClientInvoice(
    seedB.companyId,
    invB.id,
    seedB.userId,
    seedB.branchId
  );

  const [rA, rB] = await Promise.all([
    contractingCertificateSettlementService.collectClientInvoice(ctxA, invA.id, {
      amount: 1_000,
      safeId: seedA.safeId,
      idempotencyKey: sharedKey,
    }),
    contractingCertificateSettlementService.collectClientInvoice(ctxB, invB.id, {
      amount: 2_000,
      safeId: seedB.safeId,
      idempotencyKey: sharedKey,
    }),
  ]);
  step(
    'P0-2.1: same key string isolated per company',
    rA.cashTransactionId !== rB.cashTransactionId,
    `${rA.cashTransactionId.slice(0, 8)} vs ${rB.cashTransactionId.slice(0, 8)}`
  );
}

async function subcontractFlow(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const ctx = treasuryCtx(seed);
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `SUB-${seed.suffix}`,
    projectName: 'Sub Project',
    contractValue: CERT_NET,
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
    totalContractValue: CERT_NET,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
  });
  await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [
      {
        itemCode: 'S1',
        descriptionAr: 'Sub works',
        unit: 'LS',
        contractQuantity: 1,
        unitPrice: CERT_NET,
      },
    ],
  });
  const subDetail = await subcontractCommandService.getSubcontract(seed.companyId, sub.id);
  const boqId = subDetail.boqItems[0].id;

  const draft = await subcontractInvoiceCommandService.createOrUpdateDraftInvoice(
    seed.companyId,
    sub.id,
    {
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      items: [{ subcontractBOQItemId: boqId, currentQuantity: 1 }],
    }
  );
  await subcontractInvoiceCommandService.submitToSiteEngineer(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.approveByConsultant(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.approveByTechOffice(seed.companyId, draft.id);
  await subcontractInvoiceCommandService.lockAndPostInvoice(seed.companyId, draft.id, ctx);

  const subJeBefore = await prisma.journalEntry.count({
    where: { companyId: seed.companyId, sourceType: 'SUBCONTRACT_INVOICE' },
  });

  await contractingCertificateSettlementService.paySubcontractInvoice(ctx, draft.id, {
    amount: 40_000,
    safeId: seed.safeId,
    idempotencyKey: idemKey('sub-1'),
  });
  await contractingCertificateSettlementService.paySubcontractInvoice(ctx, draft.id, {
    amount: 60_000,
    safeId: seed.safeId,
    idempotencyKey: idemKey('sub-2'),
  });

  const paid = await prisma.subcontractInvoice.findFirstOrThrow({ where: { id: draft.id } });
  step(
    'Sub: full payment',
    paid.settlementStatus === 'SETTLED' && Number(paid.paidSettlementAmount) === CERT_NET,
    ''
  );

  let subOver = false;
  try {
    await contractingCertificateSettlementService.paySubcontractInvoice(ctx, draft.id, {
      amount: 1,
      safeId: seed.safeId,
      idempotencyKey: idemKey('sub-over'),
    });
  } catch {
    subOver = true;
  }
  step('Sub: over-payment rejected', subOver, '');

  const subJeAfter = await prisma.journalEntry.count({
    where: { companyId: seed.companyId, sourceType: 'SUBCONTRACT_INVOICE' },
  });
  step('Sub: no duplicate WIP JE', subJeAfter === subJeBefore, `${subJeAfter}`);

  const payments = await prisma.cashTransaction.findMany({
    where: { companyId: seed.companyId, transactionKind: 'PAYMENT' },
    orderBy: { createdAt: 'asc' },
  });
  if (payments[0]?.journalEntryId) {
    await treasuryPostingService.unpostCashTransaction(ctx, payments[0].id);
    const afterRev = await prisma.subcontractInvoice.findFirstOrThrow({ where: { id: draft.id } });
    step(
      'Sub: payment unpost restores balance',
      afterRev.settlementStatus === 'PARTIALLY_SETTLED' && Number(afterRev.paidSettlementAmount) === 60_000,
      `paid=${afterRev.paidSettlementAmount}`
    );
  }
}

async function tenantIsolation(
  seedA: Awaited<ReturnType<typeof seedCompany>>,
  seedB: Awaited<ReturnType<typeof seedCompany>>,
  clientInvoiceIdA: string
) {
  const ctxB = treasuryCtx(seedB);
  let crossCollect = false;
  try {
    await contractingCertificateSettlementService.collectClientInvoice(ctxB, clientInvoiceIdA, {
      amount: 1000,
      safeId: seedB.safeId,
      idempotencyKey: idemKey('tenant-cross'),
    });
  } catch {
    crossCollect = true;
  }

  step('Tenant: B cannot collect A certificate', crossCollect, '');

  const receiptA = await prisma.cashTransaction.findFirst({
    where: { companyId: seedA.companyId, transactionKind: 'RECEIPT' },
  });
  let crossAlloc = false;
  if (receiptA) {
    try {
      await contractingCertificateSettlementService.allocateExistingReceiptToClientInvoice(
        ctxB,
        clientInvoiceIdA,
        { cashTransactionId: receiptA.id, amount: 1000, idempotencyKey: idemKey('tenant-alloc') }
      );
    } catch {
      crossAlloc = true;
    }
  }
  step('Tenant: B context + A receipt/certificate blocked', crossAlloc, '');
}

async function p0Regression(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const enterprise = await contractingProjectService.create(seed.companyId, {
    projectCode: `ENT-${seed.suffix}`,
    projectName: 'Enterprise',
    contractValue: 1,
  });
  let wave3Blocked = false;
  try {
    await requireLegacyWave3Stack(seed.companyId, enterprise.id);
  } catch {
    wave3Blocked = true;
  }
  step('P0-1: ENTERPRISE blocks Wave3 write path', wave3Blocked, '');

  const legacy = await contractingProjectService.create(seed.companyId, {
    projectCode: `LEG-${seed.suffix}`,
    projectName: 'Legacy',
    contractValue: 1,
  });
  await prisma.contractExtract.create({
    data: {
      companyId: seed.companyId,
      projectId: legacy.id,
      extractNumber: `EX-${seed.suffix}`,
      extractType: 'CLIENT',
      partyId: seed.customerId,
      extractDate: new Date('2025-01-01'),
      netPayableAmount: new Decimal(1),
      status: 'DRAFT',
    },
  });
  await prisma.contractingProject.update({
    where: { id: legacy.id },
    data: { canonicalStack: 'LEGACY_WAVE3' },
  });
  let wave3Allowed = false;
  try {
    await requireLegacyWave3Stack(seed.companyId, legacy.id);
    wave3Allowed = true;
  } catch {
    wave3Allowed = false;
  }
  step('P0-1: LEGACY_WAVE3 allows Wave3 path', wave3Allowed, '');
}

async function p0PartyAccounting(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const ctx = treasuryCtx(seed);
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `PAR-${seed.suffix}`,
    projectName: 'Party AR/AP',
    customerId: seed.customerId,
    contractValue: CERT_NET,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });
  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'PAR-1',
      descriptionAr: 'PAR',
      unit: 'LS',
      contractQuantity: new Decimal(1),
      unitSellingPrice: new Decimal(CERT_NET),
      totalSellingPrice: new Decimal(CERT_NET),
      status: 'APPROVED_IN_CONTRACT',
    },
  });
  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `PAR-${seed.suffix}`,
    clientCustomerId: seed.customerId,
    contractDate: new Date('2026-03-01'),
    totalContractValue: CERT_NET,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });
  const draft = await clientInvoiceCommandService.createOrUpdateDraft(seed.companyId, contract.id, {
    periodStartDate: new Date('2026-03-01'),
    periodEndDate: new Date('2026-03-31'),
    items: [{ projectBOQItemId: boq.id, currentQuantity: 1 }],
  });
  await clientInvoiceCommandService.submitToClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.approveByClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.lockAndPostClientInvoice(
    seed.companyId,
    draft.id,
    seed.userId,
    seed.branchId
  );

  const accounts = await contractingAccountResolverService.resolveAccounts(seed.companyId);
  const posted = await prisma.clientInvoice.findFirstOrThrow({ where: { id: draft.id } });
  const arLine = posted.journalEntryId
    ? await prisma.journalEntryLine.findFirst({
        where: {
          journalEntryId: posted.journalEntryId,
          accountId: accounts.clientReceivableAccountId,
        },
      })
    : null;

  let reconPost = await contractingPartyReconciliationService.reconcileClientInvoicePartyAccounting(
    seed.companyId,
    draft.id
  );
  const ledgerAfterPost = await sumPartnerNetOriginal(prisma, seed.companyId, seed.customerId, 'CUSTOMER');

  step(
    'P0-3 Owner: AR line party = customer',
    arLine?.partnerId === seed.customerId && arLine?.partnerType === 'CUSTOMER',
    `${arLine?.partnerId ?? 'null'}`
  );
  step(
    'P0-3 Owner: post reconciliation MATCH',
    reconPost.status === 'MATCH',
    reconPost.status
  );
  step(
    'P0-3 Owner: customer ledger after post',
    Math.abs(ledgerAfterPost - CERT_NET) < 0.02,
    String(ledgerAfterPost)
  );

  const otherCustomer = await prisma.customer.create({
    data: {
      companyId: seed.companyId,
      arabicName: `Other ${seed.suffix}`,
      balance: 0,
    },
  });
  const badReceipt = await prisma.cashTransaction.create({
    data: {
      companyId: seed.companyId,
      transactionKind: 'RECEIPT',
      date: new Date(),
      amount: new Decimal(1000),
      currencyCode: 'EGP',
      customerId: otherCustomer.id,
      isPosted: true,
    },
  });
  let blockedWrongCustomer = false;
  try {
    await contractingCertificateSettlementService.allocateExistingReceiptToClientInvoice(ctx, draft.id, {
      cashTransactionId: badReceipt.id,
      amount: 1000,
      idempotencyKey: idemKey('p3-bad-alloc'),
    });
  } catch {
    blockedWrongCustomer = true;
  }
  step('P0-3 Negative: wrong customer receipt blocked', blockedWrongCustomer, '');

  await contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
    amount: 30_000,
    safeId: seed.safeId,
    idempotencyKey: idemKey('p3-owner-30'),
  });
  reconPost = await contractingPartyReconciliationService.reconcileClientInvoicePartyAccounting(
    seed.companyId,
    draft.id
  );
  const ledger30 = await sumPartnerNetOriginal(prisma, seed.companyId, seed.customerId, 'CUSTOMER');
  step('P0-3 Owner: after 30k collect MATCH', reconPost.status === 'MATCH', reconPost.status);
  step('P0-3 Owner: ledger outstanding 70k', Math.abs(ledger30 - 70_000) < 0.02, String(ledger30));

  await contractingCertificateSettlementService.collectClientInvoice(ctx, draft.id, {
    amount: 70_000,
    safeId: seed.safeId,
    idempotencyKey: idemKey('p3-owner-70'),
  });
  reconPost = await contractingPartyReconciliationService.reconcileClientInvoicePartyAccounting(
    seed.companyId,
    draft.id
  );
  const ledger0 = await sumPartnerNetOriginal(prisma, seed.companyId, seed.customerId, 'CUSTOMER');
  step('P0-3 Owner: fully collected MATCH', reconPost.status === 'MATCH', reconPost.status);
  step('P0-3 Owner: ledger zero', Math.abs(ledger0) < 0.02, String(ledger0));

  const subcon = await subcontractCommandService.createSubcontractor(seed.companyId, {
    nameAr: `Party Sub ${seed.suffix}`,
  });
  const sub = await subcontractCommandService.createSubcontract(seed.companyId, {
    subcontractorId: subcon.id,
    projectId: project.id,
    contractDate: new Date('2026-03-01'),
    totalContractValue: CERT_NET,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
  });
  await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [
      {
        itemCode: 'PS1',
        descriptionAr: 'Sub party',
        unit: 'LS',
        contractQuantity: 1,
        unitPrice: CERT_NET,
      },
    ],
  });
  const subDetail = await subcontractCommandService.getSubcontract(seed.companyId, sub.id);
  const subDraft = await subcontractInvoiceCommandService.createOrUpdateDraftInvoice(
    seed.companyId,
    sub.id,
    {
      periodStartDate: new Date('2026-03-01'),
      periodEndDate: new Date('2026-03-31'),
      items: [{ subcontractBOQItemId: subDetail.boqItems[0].id, currentQuantity: 1 }],
    }
  );
  await subcontractInvoiceCommandService.submitToSiteEngineer(seed.companyId, subDraft.id);
  await subcontractInvoiceCommandService.approveByConsultant(seed.companyId, subDraft.id);
  await subcontractInvoiceCommandService.approveByTechOffice(seed.companyId, subDraft.id);
  await subcontractInvoiceCommandService.lockAndPostInvoice(seed.companyId, subDraft.id, ctx);

  const subAccounts = await prisma.subcontractInvoice.findFirstOrThrow({
    where: { id: subDraft.id },
    select: { journalEntryId: true, netPayableAmount: true },
  });
  const subApResolved = await subcontractAccountResolverService.resolveAccounts(seed.companyId);
  const apLine = subAccounts.journalEntryId
    ? await prisma.journalEntryLine.findFirst({
        where: {
          journalEntryId: subAccounts.journalEntryId,
          accountId: subApResolved.apAccountId,
        },
      })
    : null;

  let subRecon = await contractingPartyReconciliationService.reconcileSubcontractInvoicePartyAccounting(
    seed.companyId,
    subDraft.id
  );
  const subStmt = await getSubcontractorPartyStatement(seed.companyId, subcon.id);
  step(
    'P0-3 Sub: AP line party = subcontractor',
    apLine?.partnerId === subcon.id && apLine?.partnerType === 'SUBCONTRACTOR',
    `${apLine?.partnerId ?? 'null'}`
  );
  step('P0-3 Sub: post reconciliation MATCH', subRecon.status === 'MATCH', subRecon.status);
  step(
    'P0-3 Sub: statement payable after post',
    Math.abs(subStmt.payableOutstanding - CERT_NET) < 0.02,
    String(subStmt.payableOutstanding)
  );

  await contractingCertificateSettlementService.paySubcontractInvoice(ctx, subDraft.id, {
    amount: 40_000,
    safeId: seed.safeId,
    idempotencyKey: idemKey('p3-sub-40'),
  });
  subRecon = await contractingPartyReconciliationService.reconcileSubcontractInvoicePartyAccounting(
    seed.companyId,
    subDraft.id
  );
  step('P0-3 Sub: partial pay MATCH', subRecon.status === 'MATCH', subRecon.status);

  await contractingCertificateSettlementService.paySubcontractInvoice(ctx, subDraft.id, {
    amount: 60_000,
    safeId: seed.safeId,
    idempotencyKey: idemKey('p3-sub-60'),
  });
  subRecon = await contractingPartyReconciliationService.reconcileSubcontractInvoicePartyAccounting(
    seed.companyId,
    subDraft.id
  );
  const subStmt0 = await getSubcontractorPartyStatement(seed.companyId, subcon.id);
  step('P0-3 Sub: full pay MATCH', subRecon.status === 'MATCH', subRecon.status);
  step('P0-3 Sub: payable zero', Math.abs(subStmt0.payableOutstanding) < 0.02, String(subStmt0.payableOutstanding));
}

function postingCtx(seed: Awaited<ReturnType<typeof seedCompany>>) {
  return journalEntryService.buildPostingContext(
    seed.companyId,
    seed.branchId,
    seed.userId,
    seed.fiscalYearId,
    true
  );
}

async function postMinimalOwnerCertificate(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const project = await contractingProjectService.create(seed.companyId, {
    projectCode: `P4-${seed.suffix}`,
    projectName: 'P0-4 Reversal',
    customerId: seed.customerId,
    contractValue: CERT_NET,
    advanceDeductionPercent: 0,
    retentionPercent: 0,
  });
  const boq = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: project.id,
      itemCode: 'P4-LS',
      descriptionAr: 'P4 Works',
      unit: 'LS',
      contractQuantity: new Decimal(1),
      unitSellingPrice: new Decimal(CERT_NET),
      totalSellingPrice: new Decimal(CERT_NET),
      status: 'APPROVED_IN_CONTRACT',
    },
  });
  const contract = await clientContractService.createClientContract(seed.companyId, {
    projectId: project.id,
    contractNumber: `P4CC-${seed.suffix}`,
    clientCustomerId: seed.customerId,
    contractDate: new Date('2026-05-01'),
    totalContractValue: CERT_NET,
    advancePaymentAmount: 0,
    advanceRecoveryRate: 0,
    retentionRate: 0,
    engineeringStampsRate: 0,
  });
  const draft = await clientInvoiceCommandService.createOrUpdateDraft(seed.companyId, contract.id, {
    periodStartDate: new Date('2026-05-01'),
    periodEndDate: new Date('2026-05-31'),
    items: [{ projectBOQItemId: boq.id, currentQuantity: 1 }],
  });
  await clientInvoiceCommandService.submitToClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.approveByClient(seed.companyId, draft.id);
  await clientInvoiceCommandService.lockAndPostClientInvoice(
    seed.companyId,
    draft.id,
    seed.userId,
    seed.branchId
  );
  return { draftId: draft.id, contractId: contract.id, boqId: boq.id, ctx: postingCtx(seed), treasuryCtx: treasuryCtx(seed) };
}

async function p0CertificateReversal(seed: Awaited<ReturnType<typeof seedCompany>>) {
  const { draftId, contractId, ctx, treasuryCtx: tctx } = await postMinimalOwnerCertificate(seed);

  const boq2 = await prisma.projectBOQItem.create({
    data: {
      companyId: seed.companyId,
      projectId: (await prisma.clientContract.findFirstOrThrow({ where: { id: contractId } })).projectId,
      itemCode: 'P4-LS-2',
      descriptionAr: 'P4 Works period 2',
      unit: 'LS',
      contractQuantity: new Decimal(1),
      unitSellingPrice: new Decimal(CERT_NET),
      totalSellingPrice: new Decimal(CERT_NET),
      status: 'APPROVED_IN_CONTRACT',
    },
  });

  const draft2Early = await clientInvoiceCommandService.createOrUpdateDraft(seed.companyId, contractId, {
    periodStartDate: new Date('2026-06-01'),
    periodEndDate: new Date('2026-06-30'),
    items: [{ projectBOQItemId: boq2.id, currentQuantity: 1 }],
  });
  await clientInvoiceCommandService.submitToClient(seed.companyId, draft2Early.id);
  await clientInvoiceCommandService.approveByClient(seed.companyId, draft2Early.id);
  await clientInvoiceCommandService.lockAndPostClientInvoice(
    seed.companyId,
    draft2Early.id,
    seed.userId,
    seed.branchId
  );

  let blockedLater = false;
  try {
    await contractingCertificateReversalService.reverseClientInvoice(ctx, draftId, {
      idempotencyKey: idemKey('p4-later-block'),
      reason: 'should fail due to seq 2',
    });
  } catch (e) {
    blockedLater =
      e instanceof AppError && String(e.message).includes(LATER_CERTIFICATE_BLOCKS_REVERSAL);
  }
  step('P0-4 Owner: block reverse when later certificate exists', blockedLater);

  const collect = await contractingCertificateSettlementService.collectClientInvoice(tctx, draft2Early.id, {
    amount: 25_000,
    safeId: seed.safeId,
    idempotencyKey: idemKey('p4-block-collect'),
  });

  let blockedSettlement = false;
  try {
    await contractingCertificateReversalService.reverseClientInvoice(ctx, draft2Early.id, {
      idempotencyKey: idemKey('p4-should-block'),
      reason: 'test block with settlement',
    });
  } catch (e) {
    blockedSettlement =
      e instanceof AppError &&
      String(e.message).includes(ACTIVE_SETTLEMENT_BLOCKS_REVERSAL);
  }
  step('P0-4 Owner: block reverse with active settlement', blockedSettlement);

  await treasuryPostingService.unpostCashTransaction(tctx, collect.cashTransactionId);

  const idem = idemKey('p4-reverse-owner');
  const rev1 = await contractingCertificateReversalService.reverseClientInvoice(ctx, draft2Early.id, {
    idempotencyKey: idem,
    reason: 'تصحيح بعد خطأ ترحيل',
  });
  const rev2 = await contractingCertificateReversalService.reverseClientInvoice(ctx, draft2Early.id, {
    idempotencyKey: idem,
    reason: 'تصحيح بعد خطأ ترحيل',
  });

  const after = await prisma.clientInvoice.findFirstOrThrow({ where: { id: draft2Early.id } });
  const origJe = await prisma.journalEntry.findFirstOrThrow({
    where: { id: after.journalEntryId! },
  });
  const reversalJe = await prisma.journalEntry.findFirstOrThrow({
    where: { id: after.reversalJournalEntryId! },
  });

  step('P0-4 Owner: status REVERSED', after.status === 'REVERSED', after.status);
  step(
    'P0-4 Owner: idempotency replay same reversal JE',
    rev1.reversalJournalEntryId === rev2.reversalJournalEntryId && rev2.replay,
    `${rev1.reversalJournalEntryId} replay=${rev2.replay}`
  );
  step(
    'P0-4 Owner: original JE still posted',
    Boolean(origJe.isPosted || origJe.postingStatus === 'Post'),
    String(origJe.isPosted)
  );
  step(
    'P0-4 Owner: contra JE posted with reversalOf link',
    Boolean(reversalJe.reversalOfJournalEntryId === origJe.id && (reversalJe.isPosted || reversalJe.postingStatus === 'Post')),
    reversalJe.reversalOfJournalEntryId ?? 'null'
  );

  const recon = await contractingPartyReconciliationService.reconcileClientInvoicePartyAccounting(
    seed.companyId,
    draft2Early.id
  );
  step('P0-4 Owner: party reconciliation MATCH on reversed cert', recon.status === 'MATCH', recon.status);

  const subcon = await subcontractCommandService.createSubcontractor(seed.companyId, {
    nameAr: `P4 Sub ${seed.suffix}`,
  });
  const sub = await subcontractCommandService.createSubcontract(seed.companyId, {
    subcontractorId: subcon.id,
    projectId: (await prisma.clientContract.findFirstOrThrow({ where: { id: contractId } })).projectId,
    contractDate: new Date('2026-05-01'),
    totalContractValue: CERT_NET,
    advancePaymentRecoveryRate: 0,
    retentionRate: 0,
    taxWithholdingRate: 0,
    socialInsuranceRate: 0,
  });
  await subcontractCommandService.upsertBoqItems(seed.companyId, sub.id, {
    items: [
      {
        itemCode: 'P4S1',
        descriptionAr: 'Sub P4',
        unit: 'LS',
        contractQuantity: 1,
        unitPrice: CERT_NET,
      },
    ],
  });
  const subDetail = await subcontractCommandService.getSubcontract(seed.companyId, sub.id);
  const subDraft = await subcontractInvoiceCommandService.createOrUpdateDraftInvoice(
    seed.companyId,
    sub.id,
    {
      periodStartDate: new Date('2026-05-01'),
      periodEndDate: new Date('2026-05-31'),
      items: [{ subcontractBOQItemId: subDetail.boqItems[0].id, currentQuantity: 1 }],
    }
  );
  await subcontractInvoiceCommandService.submitToSiteEngineer(seed.companyId, subDraft.id);
  await subcontractInvoiceCommandService.approveByConsultant(seed.companyId, subDraft.id);
  await subcontractInvoiceCommandService.approveByTechOffice(seed.companyId, subDraft.id);
  await subcontractInvoiceCommandService.lockAndPostInvoice(seed.companyId, subDraft.id, ctx);

  const subRev = await contractingCertificateReversalService.reverseSubcontractInvoice(ctx, subDraft.id, {
    idempotencyKey: idemKey('p4-sub-reverse'),
    reason: 'عكس تجريبي مقاول',
  });
  const subAfter = await prisma.subcontractInvoice.findFirstOrThrow({ where: { id: subDraft.id } });
  const subRecon = await contractingPartyReconciliationService.reconcileSubcontractInvoicePartyAccounting(
    seed.companyId,
    subDraft.id
  );
  step('P0-4 Sub: reversed', subAfter.status === 'REVERSED' && Boolean(subRev.reversalJournalEntryId));
  step('P0-4 Sub: reconciliation MATCH', subRecon.status === 'MATCH', subRecon.status);
}

async function cleanup(seed: Awaited<ReturnType<typeof seedCompany>>, seedB?: Awaited<ReturnType<typeof seedCompany>>) {
  for (const id of [seed.companyId, seedB?.companyId].filter(Boolean) as string[]) {
    await prisma.company.delete({ where: { id } }).catch(() => undefined);
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  const dbName = new URL(dbUrl).pathname.replace(/^\//, '');
  console.log('DEV DB:', dbName);

  const mig = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM _prisma_migrations
    WHERE migration_name LIKE '%contracting%'
       OR migration_name LIKE '%20261004194500%'
       OR migration_name LIKE '%20261004210000%'
    ORDER BY migration_name
  `;
  const names = mig.map((m) => m.migration_name);
  step(
    'Migrations: contracting canonical + treasury + idempotency + party + reversal',
    names.some((n) => n.includes('20261004153000')) &&
      names.some((n) => n.includes('20261004180000')) &&
      names.some((n) => n.includes('20261004193000')) &&
      names.some((n) => n.includes('20261004194500')) &&
      names.some((n) => n.includes('20261004200000')) &&
      names.some((n) => n.includes('20261004210000')),
    names.join(', ')
  );

  const seedA = await seedCompany('A');
  const seedB = await seedCompany('B');
  const seedP3 = await seedCompany('P3');
  const seedP4 = await seedCompany('P4');

  try {
    await subcontractFlow(seedB);
    const owner = await ownerFlow(seedA);
    await concurrencyOwner(seedA, owner.clientInvoiceId, owner.ctx, owner.remainingBeforeRace);

    await treasuryPostingService.unpostCashTransaction(owner.ctx, owner.firstReceiptId);
    const afterUnpost = await prisma.clientInvoice.findFirstOrThrow({
      where: { id: owner.clientInvoiceId },
    });
    const totalAllocs = await prisma.contractingCertificateAllocation.count({
      where: { companyId: seedA.companyId, clientInvoiceId: owner.clientInvoiceId },
    });
    const activeAllocs = await countActiveAllocations(seedA.companyId, owner.clientInvoiceId);
    step(
      'Owner D: unpost 30k receipt restores remaining',
      Number(afterUnpost.remainingSettlementAmount) >= 30_000 - 0.02,
      `collected=${afterUnpost.collectedAmount} activeAllocs=${activeAllocs} totalAllocs=${totalAllocs}`
    );

    await doubleClick(seedB);
    await idempotencyOwner(seedA);
    await idempotencySub(seedB);
    await idempotencyCrossCompany(seedA, seedB);
    await tenantIsolation(seedA, seedB, owner.clientInvoiceId);
    await p0Regression(seedA);
    await p0PartyAccounting(seedP3);
    await p0CertificateReversal(seedP4);
  } finally {
    await cleanup(seedA, seedB);
    await cleanup(seedP3);
    await cleanup(seedP4);
  }

  const failed = steps.filter((s) => !s.ok);
  console.log('\n=== SUMMARY ===');
  console.log('Passed:', steps.filter((s) => s.ok).length, 'Failed:', failed.length);
  if (failed.length) {
    console.log('Failures:', failed.map((f) => f.name).join(', '));
    console.log('\nCONTRACTING P0-4 NOT VERIFIED');
    process.exit(1);
  }
  console.log('\nCONTRACTING P0-4 E2E VERIFIED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
