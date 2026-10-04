import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { buildReceiptDocument, type FiscalSnapshot, type ValidationIssue } from './document';
import { ERECEIPT_LIMITS } from './limits';
import { etaReceiptQrUrl } from './qr';
import { withReceiptUuid } from './uuid';

export type IssueSource = 'POS' | 'PREPRODUCTION_TEST';

function receiptNumberFrom(branchCode: string, next: number): string {
  const suffix = `-${String(next).padStart(6, '0')}`;
  return `${branchCode.slice(0, ERECEIPT_LIMITS.maxReceiptNumberLength - suffix.length)}${suffix}`;
}

export type CommitFiscalResult =
  | { kind: 'issued'; row: Awaited<ReturnType<typeof prisma.etaReceipt.create>> }
  | { kind: 'existing'; row: Awaited<ReturnType<typeof prisma.etaReceipt.findFirst>> }
  | { kind: 'invalid'; errors: ValidationIssue[]; existingId?: string | null };

/** Authoritative freeze + device chain + receipt number. Shared by POS and PREPRODUCTION test. */
export async function commitFiscalReceipt(input: {
  companyId: string;
  terminalId: string;
  shiftId: string | null;
  posOrderId: string | null;
  issueSource: IssueSource;
  testClientKey: string | null;
  receiptType: string;
  generation: number;
  snapshotBase: Omit<FiscalSnapshot, 'receiptNumber' | 'previousUUID'>;
  device: { environment: string; branchCode: string };
  findExisting: () => Promise<{ id: string; uuid: string | null } | null>;
}): Promise<CommitFiscalResult> {
  const {
    companyId,
    terminalId,
    shiftId,
    posOrderId,
    issueSource,
    testClientKey,
    receiptType,
    generation,
    snapshotBase,
    device,
    findExisting,
  } = input;

  return prisma.$transaction(async (tx) => {
    const existing = await findExisting();
    if (existing?.uuid) return { kind: 'existing' as const, row: await tx.etaReceipt.findFirst({ where: { id: existing.id } }) };

    await tx.etaReceiptNumber.upsert({
      where: { companyId_environment_branchCode: { companyId, environment: device.environment, branchCode: device.branchCode } },
      create: { id: randomUUID(), companyId, environment: device.environment, branchCode: device.branchCode, nextNumber: 1 },
      update: {},
    });
    await tx.etaReceiptChain.upsert({
      where: { companyId_terminalId_environment: { companyId, terminalId, environment: device.environment } },
      create: { id: randomUUID(), companyId, terminalId, environment: device.environment, lastUuid: '' },
      update: {},
    });
    const numbers = await tx.$queryRaw<Array<{ nextNumber: number }>>`
      SELECT nextNumber FROM eta_receipt_numbers
      WHERE companyId = ${companyId} AND environment = ${device.environment} AND branchCode = ${device.branchCode}
      FOR UPDATE
    `;
    const chains = await tx.$queryRaw<Array<{ lastUuid: string }>>`
      SELECT lastUuid FROM eta_receipt_chains
      WHERE companyId = ${companyId} AND terminalId = ${terminalId} AND environment = ${device.environment}
      FOR UPDATE
    `;
    const nextNumber = Number(numbers[0]?.nextNumber ?? 1);
    const previousUUID = chains[0]?.lastUuid ?? '';
    const snapshot: FiscalSnapshot = {
      ...snapshotBase,
      receiptNumber: receiptNumberFrom(device.branchCode, nextNumber),
      previousUUID,
    };
    const built = buildReceiptDocument(snapshot);
    if (built.errors.length || !built.document) {
      return { kind: 'invalid' as const, errors: built.errors, existingId: existing?.id ?? null };
    }
    const sealed = withReceiptUuid(built.document);
    const late = !snapshot.referenceOldUUID && snapshot.now.getTime() - snapshot.issuedAt.getTime() > ERECEIPT_LIMITS.submissionWindowMs;
    const status = late ? 'LATE_WINDOW' : 'QUEUED';
    const data = {
      companyId,
      posOrderId,
      terminalId,
      shiftId,
      issueSource,
      testClientKey,
      environment: device.environment,
      receiptNumber: snapshot.receiptNumber,
      branchCode: device.branchCode,
      receiptType,
      typeVersion: '1.2',
      generation,
      uuid: sealed.uuid,
      previousUUID,
      referenceUUID: snapshot.referenceUUID ?? null,
      frozenJson: sealed.document as Prisma.InputJsonValue,
      submitText: sealed.submitText,
      status,
      qrUrl: etaReceiptQrUrl({
        environment: device.environment,
        uuid: sealed.uuid,
        issuedAt: snapshot.issuedAt,
        totalAmount: Number((sealed.document as { totalAmount?: number }).totalAmount ?? 0),
        issuerRin: String(((sealed.document as { seller?: { rin?: string } }).seller)?.rin ?? ''),
      }),
      validationErrors: Prisma.JsonNull,
      dateTimeIssued: snapshot.issuedAt,
      attemptCount: 0,
    };
    const row = existing
      ? await tx.etaReceipt.update({ where: { id: existing.id }, data })
      : await tx.etaReceipt.create({ data });
    await tx.etaReceiptNumber.update({
      where: { companyId_environment_branchCode: { companyId, environment: device.environment, branchCode: device.branchCode } },
      data: { nextNumber: nextNumber + 1 },
    });
    await tx.etaReceiptChain.update({
      where: { companyId_terminalId_environment: { companyId, terminalId, environment: device.environment } },
      data: { lastUuid: sealed.uuid },
    });
    return { kind: 'issued' as const, row };
  }, { timeout: 15000 });
}

export async function persistValidationFailedReceipt(input: {
  companyId: string;
  terminalId: string;
  shiftId: string | null;
  posOrderId: string | null;
  issueSource: IssueSource;
  testClientKey: string | null;
  receiptType: string;
  generation: number;
  device: { environment: string; branchCode: string };
  errors: ValidationIssue[];
  receiptNumber?: string;
  existingId?: string | null;
}) {
  const data = {
    companyId: input.companyId,
    posOrderId: input.posOrderId,
    terminalId: input.terminalId,
    shiftId: input.shiftId,
    issueSource: input.issueSource,
    testClientKey: input.testClientKey,
    environment: input.device.environment,
    receiptNumber: (input.receiptNumber ?? `V-${randomUUID()}`).slice(0, 50),
    branchCode: input.device.branchCode,
    receiptType: input.receiptType,
    generation: input.generation,
    status: 'VALIDATION_FAILED',
    validationErrors: input.errors as unknown as Prisma.InputJsonValue,
  };
  if (input.existingId) {
    return prisma.etaReceipt.update({
      where: { id: input.existingId },
      data: { status: 'VALIDATION_FAILED', validationErrors: data.validationErrors },
    });
  }
  if (input.issueSource === 'POS' && input.posOrderId) {
    return prisma.etaReceipt.upsert({
      where: { companyId_posOrderId_generation: { companyId: input.companyId, posOrderId: input.posOrderId, generation: input.generation } },
      create: data,
      update: { status: 'VALIDATION_FAILED', validationErrors: data.validationErrors },
    });
  }
  if (input.testClientKey) {
    return prisma.etaReceipt.upsert({
      where: { companyId_testClientKey: { companyId: input.companyId, testClientKey: input.testClientKey } },
      create: data,
      update: { status: 'VALIDATION_FAILED', validationErrors: data.validationErrors },
    });
  }
  return prisma.etaReceipt.create({ data });
}

export function previewFromSnapshot(snapshot: FiscalSnapshot): {
  document: Record<string, unknown> | null;
  errors: ValidationIssue[];
  totals: Record<string, number | string | null>;
} {
  const built = buildReceiptDocument(snapshot);
  if (!built.document) {
    return { document: null, errors: built.errors, totals: {} };
  }
  const doc = built.document;
  return {
    document: doc,
    errors: [],
    totals: {
      totalSales: Number(doc.totalSales ?? 0),
      totalCommercialDiscount: Number(doc.totalCommercialDiscount ?? 0),
      totalItemsDiscount: Number(doc.totalItemsDiscount ?? 0),
      netAmount: Number(doc.netAmount ?? 0),
      taxTotals: Array.isArray(doc.taxTotals)
        ? (doc.taxTotals as Array<{ amount: number }>).reduce((sum, row) => sum + Number(row.amount), 0)
        : 0,
      totalAmount: Number(doc.totalAmount ?? 0),
      paymentMethod: String(doc.paymentMethod ?? ''),
    },
  };
}
