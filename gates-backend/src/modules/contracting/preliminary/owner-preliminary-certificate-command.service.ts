import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  ClientContractInactiveError,
  ClientContractNotFoundError,
} from '../client-billing/errors/client-billing-domain.errors';
import { clientInvoiceCommandService } from '../client-billing/services/client-invoice-command.service';
import {
  buildContractingSettlementFingerprint,
  claimContractingSettlementIdempotencyInTx,
  completeContractingSettlementIdempotencyInTx,
} from '../settlement/contracting-settlement-idempotency.service';
import {
  ownerPreliminaryCertificateCalculationService,
  type OwnerPrelimLineInput,
} from './owner-preliminary-certificate-calculation.service';

const EDITABLE = new Set(['DRAFT']);
const IMMUTABLE = new Set(['APPROVED', 'CONVERTED']);

export type SaveOwnerPrelimDto = {
  certificateId?: string;
  periodStartDate: Date;
  periodEndDate: Date;
  otherClientPenalties?: number;
  lines: OwnerPrelimLineInput[];
  measurementSheetIds?: Array<{ executiveMeasurementSheetId: string; consumedQuantity: number }>;
};

async function lockPrelimInTx(tx: Prisma.TransactionClient, companyId: string, id: string) {
  await tx.$queryRaw`
    SELECT id FROM owner_preliminary_certificates
    WHERE id = ${id} AND companyId = ${companyId}
    FOR UPDATE
  `;
}

export class OwnerPreliminaryCertificateCommandService {
  async listByContract(companyId: string, clientContractId: string) {
    return prisma.ownerPreliminaryCertificate.findMany({
      where: { companyId, clientContractId },
      orderBy: { sequenceNumber: 'desc' },
      include: { lines: true },
    });
  }

  async get(companyId: string, id: string) {
    const row = await prisma.ownerPreliminaryCertificate.findFirst({
      where: { id, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } }, measurements: true },
    });
    if (!row) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
    return row;
  }

  async saveDraft(companyId: string, clientContractId: string, userId: string, dto: SaveOwnerPrelimDto) {
    return prisma.$transaction(async (tx) => {
      const contract = await tx.clientContract.findFirst({ where: { id: clientContractId, companyId } });
      if (!contract) throw new ClientContractNotFoundError(companyId, clientContractId);
      if (contract.status !== 'ACTIVE') throw new ClientContractInactiveError(contract.id, contract.status);

      let existing = null as Awaited<ReturnType<typeof tx.ownerPreliminaryCertificate.findFirst>> | null;
      if (dto.certificateId) {
        await lockPrelimInTx(tx, companyId, dto.certificateId);
        existing = await tx.ownerPreliminaryCertificate.findFirst({
          where: { id: dto.certificateId, companyId, clientContractId },
        });
        if (!existing) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
        if (!EDITABLE.has(existing.status)) {
          throw new AppError(422, 'لا يمكن تعديل مستخلص ابتدائي في هذه الحالة');
        }
      }

      const calculated = await ownerPreliminaryCertificateCalculationService.calculateInTx(
        tx,
        companyId,
        clientContractId,
        {
          lines: dto.lines,
          otherClientPenalties: dto.otherClientPenalties,
          excludePreliminaryCertificateId: existing?.id,
        }
      );

      const sequenceNumber =
        existing?.sequenceNumber ??
        (await tx.ownerPreliminaryCertificate.count({ where: { companyId, clientContractId } })) + 1;
      const certificateNumber =
        existing?.certificateNumber ??
        `PRE-${contract.contractNumber}-${String(sequenceNumber).padStart(3, '0')}`;

      const header = {
        companyId,
        clientContractId,
        projectId: contract.projectId,
        certificateNumber,
        sequenceNumber,
        periodStartDate: dto.periodStartDate,
        periodEndDate: dto.periodEndDate,
        status: 'DRAFT' as const,
        grossCurrentWorks: calculated.grossCurrentWorks,
        previousGrossWorks: calculated.previousGrossWorks,
        cumulativeGrossWorks: calculated.cumulativeGrossWorks,
        materialsOnSiteCurrent: calculated.materialsOnSiteCurrent,
        materialsOnSiteDeduction: calculated.materialsOnSiteDeduction,
        advancePaymentRecovery: calculated.advancePaymentRecovery,
        retentionDeduction: calculated.retentionDeduction,
        engineeringStampsDeduction: calculated.engineeringStampsDeduction,
        otherClientPenalties: calculated.otherClientPenalties,
        netPayablePreview: calculated.netPayablePreview,
        createdBy: existing?.createdBy ?? userId,
      };

      const cert = existing
        ? await tx.ownerPreliminaryCertificate.update({ where: { id: existing.id }, data: header })
        : await tx.ownerPreliminaryCertificate.create({ data: header });

      await tx.ownerPreliminaryCertificateLine.deleteMany({
        where: { ownerPreliminaryCertificateId: cert.id },
      });
      await tx.ownerPreliminaryCertificateLine.createMany({
        data: calculated.lines.map((line, idx) => ({
          companyId,
          ownerPreliminaryCertificateId: cert.id,
          projectBOQItemId: line.projectBOQItemId,
          lineOrder: idx + 1,
          itemCodeSnapshot: line.itemCodeSnapshot,
          descriptionArSnapshot: line.descriptionArSnapshot,
          unitSnapshot: line.unitSnapshot,
          contractQuantitySnapshot: line.contractQuantitySnapshot,
          unitRateSnapshot: line.unitRateSnapshot,
          previousCertifiedQuantity: line.previousCertifiedQuantity,
          requestedCurrentQuantity: line.requestedCurrentQuantity,
          approvedCurrentQuantity: line.approvedCurrentQuantity,
          cumulativeApprovedQuantity: line.cumulativeApprovedQuantity,
          remainingQuantity: line.remainingQuantity,
          currentAmount: line.currentAmount,
          cumulativeAmount: line.cumulativeAmount,
        })),
      });

      if (dto.measurementSheetIds?.length) {
        await this.syncMeasurementsInTx(tx, companyId, cert.id, contract.projectId, dto.measurementSheetIds);
      }

      return this.getInTx(tx, companyId, cert.id);
    });
  }

  private async syncMeasurementsInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    certificateId: string,
    projectId: string,
    links: Array<{ executiveMeasurementSheetId: string; consumedQuantity: number }>
  ) {
    await tx.ownerPreliminaryCertificateMeasurement.deleteMany({
      where: { ownerPreliminaryCertificateId: certificateId },
    });
    for (const link of links) {
      const sheet = await tx.executiveMeasurementSheet.findFirst({
        where: { id: link.executiveMeasurementSheetId, companyId, projectId },
      });
      if (!sheet) throw new AppError(404, 'دفتر الحصر غير موجود');
      if (sheet.status !== 'CONSULTANT_APPROVED') {
        throw new AppError(422, 'دفتر الحصر غير معتمد للاستخدام');
      }
      const taken = await tx.ownerPreliminaryCertificateMeasurement.findFirst({
        where: { executiveMeasurementSheetId: sheet.id },
      });
      if (taken && taken.ownerPreliminaryCertificateId !== certificateId) {
        throw new AppError(422, 'دفتر الحصر مستخدم في مستخلص ابتدائي آخر');
      }
      if (sheet.clientInvoiceId) {
        throw new AppError(422, 'دفتر الحصر مرتبط بمستخلص مالي');
      }
      await tx.ownerPreliminaryCertificateMeasurement.create({
        data: {
          companyId,
          ownerPreliminaryCertificateId: certificateId,
          executiveMeasurementSheetId: sheet.id,
          consumedQuantity: link.consumedQuantity,
        },
      });
    }
  }

  async submit(companyId: string, id: string, userId: string) {
    return this.transition(companyId, id, userId, 'DRAFT', 'SUBMITTED', { submittedAt: new Date(), submittedBy: userId });
  }

  async beginReview(companyId: string, id: string) {
    return this.transition(companyId, id, null, 'SUBMITTED', 'UNDER_REVIEW', {});
  }

  async approve(
    companyId: string,
    id: string,
    userId: string,
    lineApprovals: Array<{ projectBOQItemId: string; approvedCurrentQuantity: number }>
  ) {
    return prisma.$transaction(async (tx) => {
      await lockPrelimInTx(tx, companyId, id);
      const cert = await tx.ownerPreliminaryCertificate.findFirst({
        where: { id, companyId },
        include: { lines: true },
      });
      if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
      if (cert.status !== 'UNDER_REVIEW' && cert.status !== 'SUBMITTED') {
        throw new AppError(422, 'لا يمكن اعتماد المستخلص في هذه الحالة');
      }

      const approvalMap = new Map(lineApprovals.map((l) => [l.projectBOQItemId, l.approvedCurrentQuantity]));
      const calcLines: OwnerPrelimLineInput[] = cert.lines.map((line) => ({
        projectBOQItemId: line.projectBOQItemId,
        requestedCurrentQuantity: Number(line.requestedCurrentQuantity),
        approvedCurrentQuantity:
          approvalMap.get(line.projectBOQItemId) ?? Number(line.requestedCurrentQuantity),
      }));

      const calculated = await ownerPreliminaryCertificateCalculationService.calculateInTx(
        tx,
        companyId,
        cert.clientContractId,
        {
          lines: calcLines,
          otherClientPenalties: Number(cert.otherClientPenalties),
          excludePreliminaryCertificateId: cert.id,
          useApprovedQuantities: true,
        }
      );

      await tx.ownerPreliminaryCertificateLine.deleteMany({ where: { ownerPreliminaryCertificateId: cert.id } });
      await tx.ownerPreliminaryCertificateLine.createMany({
        data: calculated.lines.map((line, idx) => ({
          companyId,
          ownerPreliminaryCertificateId: cert.id,
          projectBOQItemId: line.projectBOQItemId,
          lineOrder: idx + 1,
          itemCodeSnapshot: line.itemCodeSnapshot,
          descriptionArSnapshot: line.descriptionArSnapshot,
          unitSnapshot: line.unitSnapshot,
          contractQuantitySnapshot: line.contractQuantitySnapshot,
          unitRateSnapshot: line.unitRateSnapshot,
          previousCertifiedQuantity: line.previousCertifiedQuantity,
          requestedCurrentQuantity: line.requestedCurrentQuantity,
          approvedCurrentQuantity: line.approvedCurrentQuantity,
          cumulativeApprovedQuantity: line.cumulativeApprovedQuantity,
          remainingQuantity: line.remainingQuantity,
          currentAmount: line.currentAmount,
          cumulativeAmount: line.cumulativeAmount,
        })),
      });

      return tx.ownerPreliminaryCertificate.update({
        where: { id: cert.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: userId,
          grossCurrentWorks: calculated.grossCurrentWorks,
          previousGrossWorks: calculated.previousGrossWorks,
          cumulativeGrossWorks: calculated.cumulativeGrossWorks,
          materialsOnSiteCurrent: calculated.materialsOnSiteCurrent,
          materialsOnSiteDeduction: calculated.materialsOnSiteDeduction,
          advancePaymentRecovery: calculated.advancePaymentRecovery,
          retentionDeduction: calculated.retentionDeduction,
          engineeringStampsDeduction: calculated.engineeringStampsDeduction,
          otherClientPenalties: calculated.otherClientPenalties,
          netPayablePreview: calculated.netPayablePreview,
        },
        include: { lines: true },
      });
    });
  }

  async reject(companyId: string, id: string, userId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      await lockPrelimInTx(tx, companyId, id);
      const cert = await tx.ownerPreliminaryCertificate.findFirst({ where: { id, companyId } });
      if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
      if (cert.status !== 'SUBMITTED' && cert.status !== 'UNDER_REVIEW') {
        throw new AppError(422, 'لا يمكن رفض المستخلص في هذه الحالة');
      }
      return tx.ownerPreliminaryCertificate.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedBy: userId,
          rejectionReason: reason,
        },
        include: { lines: true },
      });
    });
  }

  async convertToClientInvoice(
    companyId: string,
    id: string,
    userId: string,
    idempotencyKey: string
  ) {
    return prisma.$transaction(async (tx) => {
      await lockPrelimInTx(tx, companyId, id);

      const fingerprint = buildContractingSettlementFingerprint({ preliminaryCertificateId: id });
      const claim = await claimContractingSettlementIdempotencyInTx(tx, {
        companyId,
        operation: 'OWNER_PRELIMINARY_CONVERT',
        idempotencyKey,
        requestFingerprint: fingerprint,
      });

      const cert = await tx.ownerPreliminaryCertificate.findFirst({
        where: { id, companyId },
        include: { lines: true },
      });
      if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');

      if (claim.mode === 'REPLAY') {
        const replay = claim.result as { clientInvoiceId?: string };
        return {
          clientInvoiceId: replay.clientInvoiceId ?? cert.clientInvoiceId!,
          replay: true,
        };
      }

      if (cert.status === 'CONVERTED' && cert.clientInvoiceId) {
        await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, {
          cashTransactionId: cert.clientInvoiceId,
          clientInvoiceId: cert.clientInvoiceId,
        });
        return { clientInvoiceId: cert.clientInvoiceId, replay: true };
      }

      if (cert.status !== 'APPROVED') {
        throw new AppError(422, 'يجب اعتماد المستخلص الابتدائي قبل التحويل');
      }

      for (const line of cert.lines) {
        if (line.approvedCurrentQuantity == null) {
          throw new AppError(422, 'خطوط المستخلص بلا كمية معتمدة');
        }
      }

      const invoice = await clientInvoiceCommandService.createOrUpdateDraftInTx(
        tx,
        companyId,
        cert.clientContractId,
        {
          periodStartDate: cert.periodStartDate,
          periodEndDate: cert.periodEndDate,
          otherClientPenalties: Number(cert.otherClientPenalties),
          items: cert.lines.map((line) => ({
            projectBOQItemId: line.projectBOQItemId,
            currentQuantity: Number(line.approvedCurrentQuantity),
          })),
          excludePreliminaryCertificateId: cert.id,
        }
      );

      await tx.ownerPreliminaryCertificate.update({
        where: { id: cert.id },
        data: {
          status: 'CONVERTED',
          clientInvoiceId: invoice.id,
          convertedAt: new Date(),
          convertedBy: userId,
        },
      });

      await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, {
        cashTransactionId: invoice.id,
        clientInvoiceId: invoice.id,
      });

      return { clientInvoiceId: invoice.id, replay: false };
    });
  }

  private async transition(
    companyId: string,
    id: string,
    userId: string | null,
    from: string,
    to: string,
    data: Record<string, unknown>
  ) {
    return prisma.$transaction(async (tx) => {
      await lockPrelimInTx(tx, companyId, id);
      const cert = await tx.ownerPreliminaryCertificate.findFirst({ where: { id, companyId } });
      if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
      if (cert.status !== from) {
        throw new AppError(422, `انتقال غير مسموح من ${cert.status} إلى ${to}`);
      }
      if (IMMUTABLE.has(cert.status)) {
        throw new AppError(422, 'المستخلص مجمد');
      }
      return tx.ownerPreliminaryCertificate.update({
        where: { id },
        data: { status: to as never, ...data },
        include: { lines: true },
      });
    });
  }

  private async getInTx(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.ownerPreliminaryCertificate.findFirstOrThrow({
      where: { id, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } }, measurements: true },
    });
  }
}

export const ownerPreliminaryCertificateCommandService = new OwnerPreliminaryCertificateCommandService();
