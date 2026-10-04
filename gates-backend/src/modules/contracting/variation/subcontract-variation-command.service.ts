import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { sumPreviousSubCertifiedQuantityInTx } from '../preliminary/preliminary-quantity-baseline.service';
import { money, rate, toDecimal } from '../utils/money-decimal';
import {
  contractVariationCalculationService,
  type SubcontractVariationLineInput,
} from './contract-variation-calculation.service';
import {
  loadApprovedSubcontractVariationLinesInTx,
  resolveEffectiveSubcontractBoqQuantityFromBase,
} from './contract-variation-effective.service';
import {
  SubcontractVariationOverCertificationError,
  SubcontractVariationOrderNotFoundError,
  type SubcontractVariationOverCertificationDetail,
} from './variation-domain.errors';

const EDITABLE = new Set(['DRAFT']);
const IMMUTABLE = new Set(['APPROVED']);

export type SaveSubcontractVariationDto = {
  variationOrderId?: string;
  orderDate: Date;
  reason: string;
  lines: SubcontractVariationLineInput[];
};

async function lockSubVariationInTx(tx: Prisma.TransactionClient, companyId: string, id: string) {
  await tx.$queryRaw`
    SELECT id FROM subcontract_variation_orders
    WHERE id = ${id} AND companyId = ${companyId}
    FOR UPDATE
  `;
}

export class SubcontractVariationCommandService {
  async listBySubcontract(companyId: string, subcontractId: string) {
    return prisma.subcontractVariationOrder.findMany({
      where: { companyId, subcontractId },
      orderBy: { sequenceNumber: 'desc' },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
  }

  async get(companyId: string, variationOrderId: string) {
    const row = await prisma.subcontractVariationOrder.findFirst({
      where: { id: variationOrderId, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!row) throw new SubcontractVariationOrderNotFoundError(companyId, variationOrderId);
    return row;
  }

  async saveDraft(companyId: string, subcontractId: string, userId: string, dto: SaveSubcontractVariationDto) {
    return prisma.$transaction(async (tx) => {
      const subcontract = await tx.subcontract.findFirst({ where: { id: subcontractId, companyId } });
      if (!subcontract) throw new AppError(404, 'عقد الباطن غير موجود');

      let existing = null as Awaited<ReturnType<typeof tx.subcontractVariationOrder.findFirst>> | null;
      if (dto.variationOrderId) {
        await lockSubVariationInTx(tx, companyId, dto.variationOrderId);
        existing = await tx.subcontractVariationOrder.findFirst({
          where: { id: dto.variationOrderId, companyId, subcontractId },
        });
        if (!existing) throw new SubcontractVariationOrderNotFoundError(companyId, dto.variationOrderId);
        if (!EDITABLE.has(existing.status)) {
          throw new AppError(422, 'لا يمكن تعديل أمر تغيير في هذه الحالة');
        }
      }

      const calculated = await contractVariationCalculationService.previewSubcontractInTx(
        tx,
        companyId,
        subcontractId,
        { lines: dto.lines, excludeVariationOrderId: existing?.id }
      );

      const sequenceNumber =
        existing?.sequenceNumber ??
        (await tx.subcontractVariationOrder.count({ where: { companyId, subcontractId } })) + 1;
      const orderNumber = existing?.orderNumber ?? `VO-${String(sequenceNumber).padStart(3, '0')}`;

      const header = {
        companyId,
        subcontractId,
        orderNumber,
        sequenceNumber,
        orderDate: dto.orderDate,
        reason: dto.reason,
        status: 'DRAFT' as const,
        increaseValue: calculated.increaseValue,
        decreaseValue: calculated.decreaseValue,
        netImpact: calculated.netImpact,
        originalContractValueSnapshot: calculated.originalContractValueSnapshot,
        revisedContractValueSnapshot: calculated.revisedContractValuePreview,
        createdBy: existing?.createdBy ?? userId,
      };

      const order = existing
        ? await tx.subcontractVariationOrder.update({ where: { id: existing.id }, data: header })
        : await tx.subcontractVariationOrder.create({ data: header });

      await tx.subcontractVariationOrderLine.deleteMany({ where: { subcontractVariationOrderId: order.id } });
      await tx.subcontractVariationOrderLine.createMany({
        data: calculated.lines.map((line, idx) => ({
          companyId,
          subcontractVariationOrderId: order.id,
          lineOrder: idx + 1,
          changeType: line.changeType,
          subcontractBOQItemId: line.projectBOQItemId,
          itemCodeSnapshot: line.itemCodeSnapshot,
          descriptionArSnapshot: line.descriptionArSnapshot,
          unitSnapshot: line.unitSnapshot,
          originalQuantity: line.originalQuantity,
          quantityDelta: line.quantityDelta,
          effectiveQuantityAfter: line.effectiveQuantityAfter,
          originalRate: line.originalRate,
          approvedRate: line.approvedRate,
          rateDelta: line.rateDelta,
          amountImpact: line.amountImpact,
          notes: line.notes,
        })),
      });

      return this.getInTx(tx, companyId, order.id);
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

  async approve(companyId: string, id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await lockSubVariationInTx(tx, companyId, id);
      const order = await tx.subcontractVariationOrder.findFirst({
        where: { id, companyId },
        include: { lines: { orderBy: { lineOrder: 'asc' } }, subcontract: true },
      });
      if (!order) throw new SubcontractVariationOrderNotFoundError(companyId, id);
      if (order.status !== 'UNDER_REVIEW' && order.status !== 'SUBMITTED') {
        throw new AppError(422, 'لا يمكن اعتماد أمر التغيير في هذه الحالة');
      }

      await this.assertNoOverCertificationInTx(tx, companyId, order.subcontractId, order);

      const variation = rate(order.subcontract.maxAllowedVariationOrderRate);
      for (const line of order.lines) {
        if (line.changeType !== 'NEW_ITEM') continue;
        const qty = line.effectiveQuantityAfter ?? line.quantityDelta;
        const unitPrice = line.approvedRate ?? line.originalRate;
        const totalPrice = money(qty.mul(unitPrice));
        const maxAllowedQuantity = money(qty.mul(toDecimal(1).plus(variation)));
        const boq = await tx.subcontractBOQItem.create({
          data: {
            subcontractId: order.subcontractId,
            itemCode: line.itemCodeSnapshot,
            descriptionAr: line.descriptionArSnapshot,
            unit: line.unitSnapshot,
            contractQuantity: qty,
            unitPrice,
            totalPrice,
            maxAllowedQuantity,
            origin: 'VARIATION_ORDER',
            sourceVariationOrderId: order.id,
          },
        });
        await tx.subcontractVariationOrderLine.update({
          where: { id: line.id },
          data: { subcontractBOQItemId: boq.id, createdSubcontractBOQItemId: boq.id },
        });
      }

      const priorNet = await tx.subcontractVariationOrder.aggregate({
        where: { companyId, subcontractId: order.subcontractId, status: 'APPROVED' },
        _sum: { netImpact: true },
      });
      const originalSnapshot = money(order.originalContractValueSnapshot);
      const revised = money(originalSnapshot.plus(priorNet._sum.netImpact ?? 0).plus(order.netImpact));

      return tx.subcontractVariationOrder.update({
        where: { id: order.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: userId,
          revisedContractValueSnapshot: revised,
        },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
    });
  }

  async reject(companyId: string, id: string, userId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      await lockSubVariationInTx(tx, companyId, id);
      const order = await tx.subcontractVariationOrder.findFirst({ where: { id, companyId } });
      if (!order) throw new SubcontractVariationOrderNotFoundError(companyId, id);
      if (order.status !== 'SUBMITTED' && order.status !== 'UNDER_REVIEW') {
        throw new AppError(422, 'لا يمكن رفض أمر التغيير في هذه الحالة');
      }
      return tx.subcontractVariationOrder.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedBy: userId,
          rejectionReason: reason,
        },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
    });
  }

  async cancelApproved(companyId: string, id: string, userId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      await lockSubVariationInTx(tx, companyId, id);
      const order = await tx.subcontractVariationOrder.findFirst({ where: { id, companyId } });
      if (!order) throw new SubcontractVariationOrderNotFoundError(companyId, id);
      if (order.status !== 'APPROVED') {
        throw new AppError(422, 'يمكن إلغاء أوامر التغيير المعتمدة فقط');
      }
      return tx.subcontractVariationOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: userId,
          cancellationReason: reason,
        },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
    });
  }

  private async assertNoOverCertificationInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    subcontractId: string,
    order: {
      id: string;
      lines: Array<{
        changeType: string;
        subcontractBOQItemId: string | null;
        itemCodeSnapshot: string;
      }>;
    }
  ) {
    const approvedLines = await loadApprovedSubcontractVariationLinesInTx(tx, companyId, subcontractId, {
      excludeVariationOrderId: order.id,
      includePendingOrderId: order.id,
    });

    const breaches: SubcontractVariationOverCertificationDetail[] = [];
    const seen = new Set<string>();

    for (const line of order.lines) {
      if (!line.subcontractBOQItemId) continue;
      if (line.changeType !== 'QUANTITY_CHANGE' && line.changeType !== 'OMIT') continue;
      if (seen.has(line.subcontractBOQItemId)) continue;
      seen.add(line.subcontractBOQItemId);

      const boq = await tx.subcontractBOQItem.findFirst({
        where: { id: line.subcontractBOQItemId, subcontract: { companyId } },
      });
      if (!boq) continue;

      const effectiveAfter = resolveEffectiveSubcontractBoqQuantityFromBase(
        money(boq.contractQuantity),
        approvedLines,
        boq.id
      );
      const previousCertified = await sumPreviousSubCertifiedQuantityInTx(
        tx,
        companyId,
        subcontractId,
        boq.id
      );

      if (previousCertified.gt(effectiveAfter)) {
        breaches.push({
          subcontractBOQItemId: boq.id,
          itemCode: line.itemCodeSnapshot,
          previousCertifiedQuantity: previousCertified.toFixed(4),
          effectiveQuantityAfter: effectiveAfter.toFixed(4),
        });
      }
    }

    if (breaches.length) throw new SubcontractVariationOverCertificationError(breaches);
  }

  private async transition(
    companyId: string,
    id: string,
    from: string,
    to: string,
    data: Record<string, unknown>
  ) {
    return prisma.$transaction(async (tx) => {
      await lockSubVariationInTx(tx, companyId, id);
      const order = await tx.subcontractVariationOrder.findFirst({ where: { id, companyId } });
      if (!order) throw new SubcontractVariationOrderNotFoundError(companyId, id);
      if (order.status !== from) {
        throw new AppError(422, `انتقال غير مسموح من ${order.status} إلى ${to}`);
      }
      if (IMMUTABLE.has(order.status)) {
        throw new AppError(422, 'أمر التغيير مجمد');
      }
      return tx.subcontractVariationOrder.update({
        where: { id },
        data: { status: to as never, ...data },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
    });
  }

  private async getInTx(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.subcontractVariationOrder.findFirstOrThrow({
      where: { id, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
  }
}

export const subcontractVariationCommandService = new SubcontractVariationCommandService();
