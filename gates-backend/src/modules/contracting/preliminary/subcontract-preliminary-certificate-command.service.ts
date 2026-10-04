import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { SubcontractNotFoundError } from '../../subcontracts/errors/subcontract-domain.errors';
import { subcontractInvoiceCommandService } from '../../subcontracts/services/subcontract-invoice-command.service';
import {
  buildContractingSettlementFingerprint,
  claimContractingSettlementIdempotencyInTx,
  completeContractingSettlementIdempotencyInTx,
} from '../settlement/contracting-settlement-idempotency.service';
import {
  subcontractPreliminaryCertificateCalculationService,
  type SubPrelimLineInput,
} from './subcontract-preliminary-certificate-calculation.service';

const EDITABLE = new Set(['DRAFT']);
const IMMUTABLE = new Set(['APPROVED', 'CONVERTED']);

export type SaveSubPrelimDto = {
  certificateId?: string;
  periodStartDate: Date;
  periodEndDate: Date;
  lines: SubPrelimLineInput[];
  applyEarlyPaymentDiscount?: boolean;
};

async function lockPrelimInTx(tx: Prisma.TransactionClient, companyId: string, id: string) {
  await tx.$queryRaw`
    SELECT id FROM subcontract_preliminary_certificates
    WHERE id = ${id} AND companyId = ${companyId}
    FOR UPDATE
  `;
}

export class SubcontractPreliminaryCertificateCommandService {
  async listBySubcontract(companyId: string, subcontractId: string) {
    return prisma.subcontractPreliminaryCertificate.findMany({
      where: { companyId, subcontractId },
      orderBy: { sequenceNumber: 'desc' },
      include: { lines: true },
    });
  }

  async get(companyId: string, id: string) {
    const row = await prisma.subcontractPreliminaryCertificate.findFirst({
      where: { id, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!row) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
    return row;
  }

  async saveDraft(companyId: string, subcontractId: string, userId: string, dto: SaveSubPrelimDto) {
    return prisma.$transaction(async (tx) => {
      const subcontract = await tx.subcontract.findFirst({ where: { id: subcontractId, companyId } });
      if (!subcontract) throw new SubcontractNotFoundError(companyId, subcontractId);
      if (subcontract.status !== 'ACTIVE') {
        throw new AppError(409, 'Invoices can only be drafted against an ACTIVE subcontract');
      }

      let existing = null as Awaited<
        ReturnType<typeof tx.subcontractPreliminaryCertificate.findFirst>
      > | null;
      if (dto.certificateId) {
        await lockPrelimInTx(tx, companyId, dto.certificateId);
        existing = await tx.subcontractPreliminaryCertificate.findFirst({
          where: { id: dto.certificateId, companyId, subcontractId },
        });
        if (!existing) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
        if (!EDITABLE.has(existing.status)) {
          throw new AppError(422, 'لا يمكن تعديل مستخلص ابتدائي في هذه الحالة');
        }
      }

      const calculated = await subcontractPreliminaryCertificateCalculationService.calculateInTx(
        tx,
        companyId,
        subcontractId,
        {
          lines: dto.lines,
          applyEarlyPaymentDiscount: dto.applyEarlyPaymentDiscount,
          excludePreliminaryCertificateId: existing?.id,
        }
      );

      const sequenceNumber =
        existing?.sequenceNumber ??
        (await tx.subcontractPreliminaryCertificate.count({ where: { companyId, subcontractId } })) + 1;
      const certificateNumber =
        existing?.certificateNumber ??
        `SPRE-${subcontract.subcontractNumber}-${String(sequenceNumber).padStart(3, '0')}`;

      const header = {
        companyId,
        subcontractId,
        certificateNumber,
        sequenceNumber,
        periodStartDate: dto.periodStartDate,
        periodEndDate: dto.periodEndDate,
        status: 'DRAFT' as const,
        grossCurrentAmount: calculated.grossCurrentAmount,
        previousGrossAmount: calculated.previousGrossAmount,
        grossCumulativeAmount: calculated.grossCumulativeAmount,
        advancePaymentDeduction: calculated.advancePaymentDeduction,
        retentionDeduction: calculated.retentionDeduction,
        taxWithholdingDeduction: calculated.taxWithholdingDeduction,
        socialInsuranceDeduction: calculated.socialInsuranceDeduction,
        materialOveruseDeduction: calculated.materialOveruseDeduction,
        sitePenaltiesDeduction: calculated.sitePenaltiesDeduction,
        directExecutionDeduction: calculated.directExecutionDeduction,
        earlyPaymentDiscountDeduction: calculated.earlyPaymentDiscountDeduction,
        netPayablePreview: calculated.netPayablePreview,
        createdBy: existing?.createdBy ?? userId,
      };

      const cert = existing
        ? await tx.subcontractPreliminaryCertificate.update({ where: { id: existing.id }, data: header })
        : await tx.subcontractPreliminaryCertificate.create({ data: header });

      await tx.subcontractPreliminaryCertificateLine.deleteMany({
        where: { subcontractPreliminaryCertificateId: cert.id },
      });
      await tx.subcontractPreliminaryCertificateLine.createMany({
        data: calculated.lines.map((line, idx) => ({
          companyId,
          subcontractPreliminaryCertificateId: cert.id,
          subcontractBOQItemId: line.subcontractBOQItemId,
          lineOrder: idx + 1,
          itemCodeSnapshot: line.itemCodeSnapshot,
          descriptionArSnapshot: line.descriptionArSnapshot,
          unitSnapshot: line.unitSnapshot,
          contractQuantitySnapshot: line.contractQuantitySnapshot,
          maxAllowedQuantitySnapshot: line.maxAllowedQuantitySnapshot,
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

      return this.getInTx(tx, companyId, cert.id);
    });
  }

  async submit(companyId: string, id: string, userId: string) {
    return this.transition(companyId, id, 'DRAFT', 'SUBMITTED', {
      submittedAt: new Date(),
      submittedBy: userId,
    });
  }

  async beginReview(companyId: string, id: string) {
    return this.transition(companyId, id, 'SUBMITTED', 'UNDER_REVIEW', {});
  }

  async approve(
    companyId: string,
    id: string,
    userId: string,
    lineApprovals: Array<{ subcontractBOQItemId: string; approvedCurrentQuantity: number }>
  ) {
    return prisma.$transaction(async (tx) => {
      await lockPrelimInTx(tx, companyId, id);
      const cert = await tx.subcontractPreliminaryCertificate.findFirst({
        where: { id, companyId },
        include: { lines: true },
      });
      if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
      if (cert.status !== 'UNDER_REVIEW' && cert.status !== 'SUBMITTED') {
        throw new AppError(422, 'لا يمكن اعتماد المستخلص في هذه الحالة');
      }

      const approvalMap = new Map(lineApprovals.map((l) => [l.subcontractBOQItemId, l.approvedCurrentQuantity]));
      const calcLines: SubPrelimLineInput[] = cert.lines.map((line) => ({
        subcontractBOQItemId: line.subcontractBOQItemId,
        requestedCurrentQuantity: Number(line.requestedCurrentQuantity),
        approvedCurrentQuantity:
          approvalMap.get(line.subcontractBOQItemId) ?? Number(line.requestedCurrentQuantity),
      }));

      const calculated = await subcontractPreliminaryCertificateCalculationService.calculateInTx(
        tx,
        companyId,
        cert.subcontractId,
        {
          lines: calcLines,
          applyEarlyPaymentDiscount: cert.earlyPaymentDiscountDeduction.gt(0),
          excludePreliminaryCertificateId: cert.id,
          useApprovedQuantities: true,
        }
      );

      await tx.subcontractPreliminaryCertificateLine.deleteMany({
        where: { subcontractPreliminaryCertificateId: cert.id },
      });
      await tx.subcontractPreliminaryCertificateLine.createMany({
        data: calculated.lines.map((line, idx) => ({
          companyId,
          subcontractPreliminaryCertificateId: cert.id,
          subcontractBOQItemId: line.subcontractBOQItemId,
          lineOrder: idx + 1,
          itemCodeSnapshot: line.itemCodeSnapshot,
          descriptionArSnapshot: line.descriptionArSnapshot,
          unitSnapshot: line.unitSnapshot,
          contractQuantitySnapshot: line.contractQuantitySnapshot,
          maxAllowedQuantitySnapshot: line.maxAllowedQuantitySnapshot,
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

      return tx.subcontractPreliminaryCertificate.update({
        where: { id: cert.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: userId,
          grossCurrentAmount: calculated.grossCurrentAmount,
          previousGrossAmount: calculated.previousGrossAmount,
          grossCumulativeAmount: calculated.grossCumulativeAmount,
          advancePaymentDeduction: calculated.advancePaymentDeduction,
          retentionDeduction: calculated.retentionDeduction,
          taxWithholdingDeduction: calculated.taxWithholdingDeduction,
          socialInsuranceDeduction: calculated.socialInsuranceDeduction,
          materialOveruseDeduction: calculated.materialOveruseDeduction,
          sitePenaltiesDeduction: calculated.sitePenaltiesDeduction,
          directExecutionDeduction: calculated.directExecutionDeduction,
          earlyPaymentDiscountDeduction: calculated.earlyPaymentDiscountDeduction,
          netPayablePreview: calculated.netPayablePreview,
        },
        include: { lines: true },
      });
    });
  }

  async reject(companyId: string, id: string, userId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      await lockPrelimInTx(tx, companyId, id);
      const cert = await tx.subcontractPreliminaryCertificate.findFirst({ where: { id, companyId } });
      if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
      if (cert.status !== 'SUBMITTED' && cert.status !== 'UNDER_REVIEW') {
        throw new AppError(422, 'لا يمكن رفض المستخلص في هذه الحالة');
      }
      return tx.subcontractPreliminaryCertificate.update({
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

  async convertToSubcontractInvoice(
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
        operation: 'SUBCONTRACT_PRELIMINARY_CONVERT',
        idempotencyKey,
        requestFingerprint: fingerprint,
      });

      const cert = await tx.subcontractPreliminaryCertificate.findFirst({
        where: { id, companyId },
        include: { lines: true },
      });
      if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');

      if (claim.mode === 'REPLAY') {
        const replay = claim.result as { subcontractInvoiceId?: string };
        return {
          subcontractInvoiceId: replay.subcontractInvoiceId ?? cert.subcontractInvoiceId!,
          replay: true,
        };
      }

      if (cert.status === 'CONVERTED' && cert.subcontractInvoiceId) {
        await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, {
          cashTransactionId: cert.subcontractInvoiceId,
          clientInvoiceId: cert.subcontractInvoiceId,
        });
        return { subcontractInvoiceId: cert.subcontractInvoiceId, replay: true };
      }

      if (cert.status !== 'APPROVED') {
        throw new AppError(422, 'يجب اعتماد المستخلص الابتدائي قبل التحويل');
      }

      for (const line of cert.lines) {
        if (line.approvedCurrentQuantity == null) {
          throw new AppError(422, 'خطوط المستخلص بلا كمية معتمدة');
        }
      }

      const invoice = await subcontractInvoiceCommandService.createOrUpdateDraftInvoiceInTx(
        tx,
        companyId,
        cert.subcontractId,
        {
          periodStartDate: cert.periodStartDate,
          periodEndDate: cert.periodEndDate,
          applyEarlyPaymentDiscount: cert.earlyPaymentDiscountDeduction.gt(0),
          items: cert.lines.map((line) => ({
            subcontractBOQItemId: line.subcontractBOQItemId,
            currentQuantity: line.approvedCurrentQuantity!,
          })),
          excludePreliminaryCertificateId: cert.id,
        }
      );

      await tx.subcontractPreliminaryCertificate.update({
        where: { id: cert.id },
        data: {
          status: 'CONVERTED',
          subcontractInvoiceId: invoice.id,
          convertedAt: new Date(),
          convertedBy: userId,
        },
      });

      await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, {
        cashTransactionId: invoice.id,
        clientInvoiceId: invoice.id,
      });

      return { subcontractInvoiceId: invoice.id, replay: false };
    });
  }

  private async transition(
    companyId: string,
    id: string,
    from: string,
    to: string,
    data: Record<string, unknown>
  ) {
    return prisma.$transaction(async (tx) => {
      await lockPrelimInTx(tx, companyId, id);
      const cert = await tx.subcontractPreliminaryCertificate.findFirst({ where: { id, companyId } });
      if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');
      if (cert.status !== from) {
        throw new AppError(422, `انتقال غير مسموح من ${cert.status} إلى ${to}`);
      }
      if (IMMUTABLE.has(cert.status)) {
        throw new AppError(422, 'المستخلص مجمد');
      }
      return tx.subcontractPreliminaryCertificate.update({
        where: { id },
        data: { status: to as never, ...data },
        include: { lines: true },
      });
    });
  }

  private async getInTx(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.subcontractPreliminaryCertificate.findFirstOrThrow({
      where: { id, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
  }
}

export const subcontractPreliminaryCertificateCommandService =
  new SubcontractPreliminaryCertificateCommandService();
