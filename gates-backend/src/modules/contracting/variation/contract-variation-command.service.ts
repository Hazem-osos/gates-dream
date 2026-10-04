import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  ClientContractInactiveError,
  ClientContractNotFoundError,
} from '../client-billing/errors/client-billing-domain.errors';
import { sumPreviousOwnerCertifiedQuantityInTx } from '../preliminary/preliminary-quantity-baseline.service';
import { money, moneyZero, sumMoney } from '../utils/money-decimal';
import {
  contractVariationCalculationService,
  parseOwnerBoqUnit,
  type OwnerVariationLineInput,
} from './contract-variation-calculation.service';
import {
  loadApprovedOwnerVariationLinesInTx,
  resolveEffectiveOwnerBoqQuantityFromBase,
  resolveEffectiveOwnerBoqRateFromLines,
  sumApprovedQuantityDelta,
} from './contract-variation-effective.service';
import {
  ContractVariationOverCertificationError,
  ContractVariationOrderNotFoundError,
  type ContractVariationOverCertificationDetail,
} from './variation-domain.errors';

const EDITABLE = new Set(['DRAFT']);
const IMMUTABLE = new Set(['APPROVED']);

export type SaveContractVariationDto = {
  variationOrderId?: string;
  orderDate: Date;
  reason: string;
  lines: OwnerVariationLineInput[];
};

async function lockVariationInTx(tx: Prisma.TransactionClient, companyId: string, id: string) {
  await tx.$queryRaw`
    SELECT id FROM contract_variation_orders
    WHERE id = ${id} AND companyId = ${companyId}
    FOR UPDATE
  `;
}

export class ContractVariationCommandService {
  async listByContract(companyId: string, clientContractId: string) {
    return prisma.contractVariationOrder.findMany({
      where: { companyId, clientContractId },
      orderBy: { sequenceNumber: 'desc' },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
  }

  async get(companyId: string, variationOrderId: string) {
    const row = await prisma.contractVariationOrder.findFirst({
      where: { id: variationOrderId, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!row) throw new ContractVariationOrderNotFoundError(companyId, variationOrderId);
    return row;
  }

  async getContractBoqScope(companyId: string, clientContractId: string) {
    const contract = await prisma.clientContract.findFirst({ where: { id: clientContractId, companyId } });
    if (!contract) throw new ClientContractNotFoundError(companyId, clientContractId);

    const approvedLines = await loadApprovedOwnerVariationLinesInTx(prisma, companyId, clientContractId);
    const voNumbers = new Map(
      (
        await prisma.contractVariationOrder.findMany({
          where: { companyId, clientContractId, status: 'APPROVED' },
          select: { id: true, orderNumber: true },
        })
      ).map((o) => [o.id, o.orderNumber])
    );

    const boqItems = await prisma.projectBOQItem.findMany({
      where: { companyId, projectId: contract.projectId },
      orderBy: { itemCode: 'asc' },
    });

    const sumApprovedNet = sumMoney(
      (
        await prisma.contractVariationOrder.findMany({
          where: { companyId, clientContractId, status: 'APPROVED' },
          select: { netImpact: true },
        })
      ).map((o) => money(o.netImpact))
    );

    const originalContractValue = money(contract.totalContractValue);
    const revisedContractValue = money(originalContractValue.plus(sumApprovedNet));

    const items = boqItems.map((boq) => {
      const originalQuantity = money(boq.contractQuantity);
      const approvedVariationQuantityDelta = sumApprovedQuantityDelta(approvedLines, boq.id);
      const effectiveQuantity = resolveEffectiveOwnerBoqQuantityFromBase(
        originalQuantity,
        approvedLines,
        boq.id
      );
      const originalRate = money(boq.unitSellingPrice);
      const effectiveRate = resolveEffectiveOwnerBoqRateFromLines(originalRate, approvedLines, boq.id);
      const originalAmount = money(originalQuantity.mul(originalRate));
      const revisedAmount = money(effectiveQuantity.mul(effectiveRate));
      return {
        projectBOQItemId: boq.id,
        itemCode: boq.itemCode,
        origin: boq.origin,
        sourceVariationOrderNumber: boq.sourceVariationOrderId
          ? (voNumbers.get(boq.sourceVariationOrderId) ?? null)
          : null,
        originalQuantity: Number(originalQuantity),
        approvedVariationQuantityDelta: Number(approvedVariationQuantityDelta),
        effectiveQuantity: Number(effectiveQuantity),
        originalRate: Number(originalRate),
        effectiveRate: Number(effectiveRate),
        originalAmount: Number(originalAmount),
        variationAmountImpact: Number(revisedAmount.minus(originalAmount)),
        revisedAmount: Number(revisedAmount),
      };
    });

    return {
      clientContractId,
      originalContractValue: Number(originalContractValue),
      approvedVariationNetImpact: Number(sumApprovedNet),
      revisedContractValue: Number(revisedContractValue),
      items,
    };
  }

  async saveDraft(companyId: string, clientContractId: string, userId: string, dto: SaveContractVariationDto) {
    return prisma.$transaction(async (tx) => {
      const contract = await tx.clientContract.findFirst({ where: { id: clientContractId, companyId } });
      if (!contract) throw new ClientContractNotFoundError(companyId, clientContractId);
      if (contract.status !== 'ACTIVE') throw new ClientContractInactiveError(contract.id, contract.status);

      let existing = null as Awaited<ReturnType<typeof tx.contractVariationOrder.findFirst>> | null;
      if (dto.variationOrderId) {
        await lockVariationInTx(tx, companyId, dto.variationOrderId);
        existing = await tx.contractVariationOrder.findFirst({
          where: { id: dto.variationOrderId, companyId, clientContractId },
        });
        if (!existing) throw new ContractVariationOrderNotFoundError(companyId, dto.variationOrderId);
        if (!EDITABLE.has(existing.status)) {
          throw new AppError(422, 'لا يمكن تعديل أمر تغيير في هذه الحالة');
        }
      }

      const calculated = await contractVariationCalculationService.previewOwnerInTx(tx, companyId, clientContractId, {
        lines: dto.lines,
        excludeVariationOrderId: existing?.id,
      });

      const sequenceNumber =
        existing?.sequenceNumber ??
        (await tx.contractVariationOrder.count({ where: { companyId, clientContractId } })) + 1;
      const orderNumber = existing?.orderNumber ?? `VO-${String(sequenceNumber).padStart(3, '0')}`;

      const header = {
        companyId,
        projectId: contract.projectId,
        clientContractId,
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
        ? await tx.contractVariationOrder.update({ where: { id: existing.id }, data: header })
        : await tx.contractVariationOrder.create({ data: header });

      await tx.contractVariationOrderLine.deleteMany({ where: { contractVariationOrderId: order.id } });
      await tx.contractVariationOrderLine.createMany({
        data: calculated.lines.map((line, idx) => ({
          companyId,
          contractVariationOrderId: order.id,
          lineOrder: idx + 1,
          changeType: line.changeType,
          projectBOQItemId: line.projectBOQItemId,
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
      await lockVariationInTx(tx, companyId, id);
      const order = await tx.contractVariationOrder.findFirst({
        where: { id, companyId },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
      if (!order) throw new ContractVariationOrderNotFoundError(companyId, id);
      if (order.status !== 'UNDER_REVIEW' && order.status !== 'SUBMITTED') {
        throw new AppError(422, 'لا يمكن اعتماد أمر التغيير في هذه الحالة');
      }

      await this.assertNoOverCertificationInTx(tx, companyId, order.clientContractId, order);

      const createdBoqIds: Array<{ lineId: string; boqId: string }> = [];
      for (const line of order.lines) {
        if (line.changeType !== 'NEW_ITEM') continue;
        const qty = line.effectiveQuantityAfter ?? line.quantityDelta;
        const unitPrice = line.approvedRate ?? line.originalRate;
        const boq = await tx.projectBOQItem.create({
          data: {
            companyId,
            projectId: order.projectId,
            itemCode: line.itemCodeSnapshot,
            descriptionAr: line.descriptionArSnapshot,
            unit: parseOwnerBoqUnit(line.unitSnapshot),
            contractQuantity: qty,
            unitSellingPrice: unitPrice,
            totalSellingPrice: money(qty.mul(unitPrice)),
            origin: 'VARIATION_ORDER',
            sourceVariationOrderId: order.id,
            status: 'PRICED',
          },
        });
        createdBoqIds.push({ lineId: line.id, boqId: boq.id });
      }

      for (const link of createdBoqIds) {
        await tx.contractVariationOrderLine.update({
          where: { id: link.lineId },
          data: { projectBOQItemId: link.boqId, createdProjectBOQItemId: link.boqId },
        });
      }

      const priorNet = await tx.contractVariationOrder.aggregate({
        where: { companyId, clientContractId: order.clientContractId, status: 'APPROVED' },
        _sum: { netImpact: true },
      });
      const originalSnapshot = money(order.originalContractValueSnapshot);
      const revised = money(originalSnapshot.plus(priorNet._sum.netImpact ?? 0).plus(order.netImpact));

      return tx.contractVariationOrder.update({
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
      await lockVariationInTx(tx, companyId, id);
      const order = await tx.contractVariationOrder.findFirst({ where: { id, companyId } });
      if (!order) throw new ContractVariationOrderNotFoundError(companyId, id);
      if (order.status !== 'SUBMITTED' && order.status !== 'UNDER_REVIEW') {
        throw new AppError(422, 'لا يمكن رفض أمر التغيير في هذه الحالة');
      }
      return tx.contractVariationOrder.update({
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
      await lockVariationInTx(tx, companyId, id);
      const order = await tx.contractVariationOrder.findFirst({
        where: { id, companyId },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
      if (!order) throw new ContractVariationOrderNotFoundError(companyId, id);
      if (order.status !== 'APPROVED') {
        throw new AppError(422, 'يمكن إلغاء أوامر التغيير المعتمدة فقط');
      }
      const approvedWithoutThis = await loadApprovedOwnerVariationLinesInTx(tx, companyId, order.clientContractId, {
        excludeVariationOrderId: order.id,
      });
      const breaches: ContractVariationOverCertificationDetail[] = [];
      const seen = new Set<string>();
      for (const line of order.lines) {
        if (!line.projectBOQItemId) continue;
        if (line.changeType !== 'QUANTITY_CHANGE' && line.changeType !== 'OMIT') continue;
        if (seen.has(line.projectBOQItemId)) continue;
        seen.add(line.projectBOQItemId);
        const boq = await tx.projectBOQItem.findFirst({ where: { id: line.projectBOQItemId, companyId } });
        if (!boq) continue;
        const effectiveAfter = resolveEffectiveOwnerBoqQuantityFromBase(
          money(boq.contractQuantity),
          approvedWithoutThis,
          boq.id
        );
        const previousCertified = await sumPreviousOwnerCertifiedQuantityInTx(
          tx,
          companyId,
          order.clientContractId,
          boq.id
        );
        if (previousCertified.gt(effectiveAfter)) {
          breaches.push({
            projectBOQItemId: boq.id,
            itemCode: line.itemCodeSnapshot,
            previousCertifiedQuantity: previousCertified.toFixed(4),
            effectiveQuantityAfter: effectiveAfter.toFixed(4),
          });
        }
      }
      if (breaches.length) throw new ContractVariationOverCertificationError(breaches);

      return tx.contractVariationOrder.update({
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
    clientContractId: string,
    order: { id: string; lines: Array<{ changeType: string; projectBOQItemId: string | null; itemCodeSnapshot: string; effectiveQuantityAfter: Prisma.Decimal | null }> }
  ) {
    const approvedLines = await loadApprovedOwnerVariationLinesInTx(tx, companyId, clientContractId, {
      excludeVariationOrderId: order.id,
      includePendingOrderId: order.id,
    });

    const breaches: ContractVariationOverCertificationDetail[] = [];
    const seen = new Set<string>();

    for (const line of order.lines) {
      if (!line.projectBOQItemId) continue;
      if (line.changeType !== 'QUANTITY_CHANGE' && line.changeType !== 'OMIT') continue;
      if (seen.has(line.projectBOQItemId)) continue;
      seen.add(line.projectBOQItemId);

      const boq = await tx.projectBOQItem.findFirst({
        where: { id: line.projectBOQItemId, companyId },
      });
      if (!boq) continue;

      const effectiveAfter = resolveEffectiveOwnerBoqQuantityFromBase(
        money(boq.contractQuantity),
        approvedLines,
        boq.id
      );
      const previousCertified = await sumPreviousOwnerCertifiedQuantityInTx(
        tx,
        companyId,
        clientContractId,
        boq.id
      );

      if (previousCertified.gt(effectiveAfter)) {
        breaches.push({
          projectBOQItemId: boq.id,
          itemCode: line.itemCodeSnapshot,
          previousCertifiedQuantity: previousCertified.toFixed(4),
          effectiveQuantityAfter: effectiveAfter.toFixed(4),
        });
      }
    }

    if (breaches.length) throw new ContractVariationOverCertificationError(breaches);
  }

  private async transition(
    companyId: string,
    id: string,
    from: string,
    to: string,
    data: Record<string, unknown>
  ) {
    return prisma.$transaction(async (tx) => {
      await lockVariationInTx(tx, companyId, id);
      const order = await tx.contractVariationOrder.findFirst({ where: { id, companyId } });
      if (!order) throw new ContractVariationOrderNotFoundError(companyId, id);
      if (order.status !== from) {
        throw new AppError(422, `انتقال غير مسموح من ${order.status} إلى ${to}`);
      }
      if (IMMUTABLE.has(order.status)) {
        throw new AppError(422, 'أمر التغيير مجمد');
      }
      return tx.contractVariationOrder.update({
        where: { id },
        data: { status: to as never, ...data },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
    });
  }

  private async getInTx(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.contractVariationOrder.findFirstOrThrow({
      where: { id, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
  }
}

export const contractVariationCommandService = new ContractVariationCommandService();
