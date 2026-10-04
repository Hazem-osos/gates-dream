import { Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { applyReceiptCorrection } from './document';
import { etaReceiptQrUrl } from './qr';
import { withReceiptUuid } from './uuid';
import { toFiscalPublic, type FiscalPublic } from './issue.service';
import { ERECEIPT_LIMITS } from './limits';
import { clearPosTokenCache } from './auth';

export async function correctInvalidReceipt(
  companyId: string,
  receiptId: string,
  patch: {
    buyer?: { type?: 'B' | 'P' | 'F'; id?: string; name?: string };
    lines?: Array<{ index: number; itemCode?: string; itemType?: 'GS1' | 'EGS'; unitType?: string; subType?: string }>;
  }
): Promise<FiscalPublic> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.etaReceipt.findFirst({ where: { id: receiptId, companyId } });
    if (!original?.uuid || !original.frozenJson || original.status !== 'INVALID') {
      return toFiscalPublic({ status: 'ATTENTION', validationErrors: [{ step: 'correction', propertyPath: 'status', errorCode: 'NOT_INVALID', message: 'Only an invalid frozen receipt can be corrected', messageAr: 'التصحيح متاح للإيصال المرفوض فقط' }] });
    }
    const corrected = applyReceiptCorrection(original.frozenJson as Record<string, unknown>, patch);
    if (corrected.rejected) {
      return toFiscalPublic({ status: 'ATTENTION', validationErrors: [{ step: 'correction', propertyPath: corrected.rejected, errorCode: 'PATCH', message: 'The correction was rejected', messageAr: 'التصحيح مرفوض' }] });
    }
    const header = corrected.document.header as Record<string, unknown>;
    // FAQ: a corrected receipt keeps the invalid receipt's previousUUID.
    // Later receipts stay pointed at the invalid UUID. The device head does not move.
    header.previousUUID = original.previousUUID ?? '';
    header.referenceOldUUID = original.uuid;
    header.uuid = '';
    const sealed = withReceiptUuid(corrected.document);
    if (sealed.uuid === original.uuid || sealed.uuid === original.previousUUID) {
      return toFiscalPublic({ status: 'ATTENTION', validationErrors: [{ step: 'correction', propertyPath: 'header.uuid', errorCode: 'CORRECTION_UUID', message: 'The correction did not produce a distinct receipt UUID', messageAr: 'التصحيح لم ينتج UUID مختلفًا' }] });
    }
    const latest = await tx.etaReceipt.aggregate({
      where: { companyId, posOrderId: original.posOrderId },
      _max: { generation: true },
    });
    const generation = (latest._max.generation ?? original.generation) + 1;
    const issuedAt = original.dateTimeIssued ?? new Date();
    const late = Date.now() - issuedAt.getTime() > ERECEIPT_LIMITS.submissionWindowMs;
    const row = await tx.etaReceipt.create({
      data: {
        companyId,
        posOrderId: original.posOrderId,
        terminalId: original.terminalId,
        shiftId: original.shiftId,
        environment: original.environment,
        receiptNumber: `${original.receiptNumber}-C${generation}`.slice(0, 50),
        branchCode: original.branchCode,
        receiptType: original.receiptType,
        typeVersion: '1.2',
        generation,
        uuid: sealed.uuid,
        previousUUID: String(header.previousUUID),
        referenceUUID: original.referenceUUID,
        referenceOldUUID: original.uuid,
        frozenJson: sealed.document as Prisma.InputJsonValue,
        submitText: sealed.submitText,
        status: 'QUEUED',
        qrUrl: etaReceiptQrUrl({
          environment: original.environment,
          uuid: sealed.uuid,
          issuedAt,
          totalAmount: Number((sealed.document as { totalAmount?: number }).totalAmount ?? 0),
          issuerRin: String(((sealed.document as { seller?: { rin?: string } }).seller)?.rin ?? ''),
        }),
        dateTimeIssued: issuedAt,
        correctedFromId: original.id,
        lateReason: late ? original.lateReason : null,
      },
    });
    return toFiscalPublic(row);
  }, { timeout: 15000 });
}

export async function recordLateReason(companyId: string, receiptId: string, reason: string): Promise<FiscalPublic> {
  const row = await prisma.etaReceipt.findFirst({ where: { id: receiptId, companyId, status: 'LATE_WINDOW' } });
  if (!row) return toFiscalPublic({ status: 'ATTENTION' });
  clearPosTokenCache();
  const updated = await prisma.etaReceipt.update({
    where: { id: row.id },
    data: { lateReason: reason.slice(0, 500), status: 'QUEUED' },
  });
  return toFiscalPublic(updated);
}
