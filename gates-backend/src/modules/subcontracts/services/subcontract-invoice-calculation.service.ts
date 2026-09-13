import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { BoqLimitExceededError, SubcontractNotFoundError } from '../errors/subcontract-domain.errors';
import type { BoqLimitExceededDetail } from '../errors/subcontract-domain.errors';
import type {
  CalculateDraftInvoiceParams,
  CalculatedDraftInvoice,
  CalculatedInvoiceLine,
} from '../types/subcontract-invoice.types';
import { HISTORICAL_INVOICE_STATUSES } from '../types/subcontract-invoice.types';
import { money, moneyMin, moneyZero, rate, sumMoney } from '../utils/money-decimal';

type Db = Prisma.TransactionClient | typeof prisma;

export class SubcontractInvoiceCalculationService {
  async calculateDraftInvoice(params: CalculateDraftInvoiceParams): Promise<CalculatedDraftInvoice> {
    return this.calculateDraftInvoiceInTx(prisma, params);
  }

  async calculateDraftInvoiceInTx(
    db: Db,
    params: CalculateDraftInvoiceParams
  ): Promise<CalculatedDraftInvoice> {
    const subcontract = await db.subcontract.findFirst({
      where: { id: params.subcontractId, companyId: params.companyId },
      include: { boqItems: true },
    });
    if (!subcontract) {
      throw new SubcontractNotFoundError(params.companyId, params.subcontractId);
    }

    const seen = new Set<string>();
    for (const line of params.items) {
      if (seen.has(line.subcontractBOQItemId)) {
        throw new AppError(400, `Duplicate BOQ item on invoice: ${line.subcontractBOQItemId}`);
      }
      seen.add(line.subcontractBOQItemId);
    }

    const priorInvoices = await db.subcontractInvoice.findMany({
      where: {
        companyId: params.companyId,
        subcontractId: params.subcontractId,
        status: { in: [...HISTORICAL_INVOICE_STATUSES] },
        ...(params.excludeInvoiceId ? { id: { not: params.excludeInvoiceId } } : {}),
      },
      include: { items: true },
      orderBy: { sequenceNumber: 'asc' },
    });

    const previousQtyByBoq = new Map<string, ReturnType<typeof money>>();
    for (const invoice of priorInvoices) {
      for (const item of invoice.items) {
        const prev = previousQtyByBoq.get(item.subcontractBOQItemId) ?? moneyZero();
        previousQtyByBoq.set(item.subcontractBOQItemId, money(prev.plus(item.currentQuantity)));
      }
    }

    const previousGrossAmount = sumMoney(priorInvoices.map((row) => row.grossCurrentAmount));
    const previouslyRecoveredAdvance = sumMoney(
      priorInvoices.map((row) => row.advancePaymentDeduction)
    );

    const boqById = new Map(subcontract.boqItems.map((row) => [row.id, row]));
    const breaches: BoqLimitExceededDetail[] = [];
    const lines: CalculatedInvoiceLine[] = [];

    for (const input of params.items) {
      const boq = boqById.get(input.subcontractBOQItemId);
      if (!boq) {
        throw new AppError(400, `BOQ item ${input.subcontractBOQItemId} is not on this subcontract`);
      }

      const previousQuantity = previousQtyByBoq.get(boq.id) ?? moneyZero();
      const currentQuantity = money(input.currentQuantity);
      if (currentQuantity.lt(0)) {
        throw new AppError(400, `Current quantity cannot be negative for ${boq.itemCode}`);
      }

      const totalCumulativeQuantity = money(previousQuantity.plus(currentQuantity));
      const maxAllowedQuantity = money(boq.maxAllowedQuantity);
      const unitPrice = money(boq.unitPrice);
      const totalCurrentAmount = money(currentQuantity.mul(unitPrice));
      const contractQuantity = money(boq.contractQuantity);
      const completionPercentage = contractQuantity.gt(0)
        ? money(totalCumulativeQuantity.div(contractQuantity).mul(100))
        : moneyZero();

      if (totalCumulativeQuantity.gt(maxAllowedQuantity)) {
        breaches.push({
          subcontractBOQItemId: boq.id,
          itemCode: boq.itemCode,
          previousQuantity: previousQuantity.toFixed(4),
          currentQuantity: currentQuantity.toFixed(4),
          totalCumulativeQuantity: totalCumulativeQuantity.toFixed(4),
          maxAllowedQuantity: maxAllowedQuantity.toFixed(4),
        });
      }

      lines.push({
        subcontractBOQItemId: boq.id,
        itemCode: boq.itemCode,
        previousQuantity,
        currentQuantity,
        totalCumulativeQuantity,
        completionPercentage,
        unitPrice,
        totalCurrentAmount,
        maxAllowedQuantity,
        contractQuantity,
      });
    }

    if (breaches.length) {
      throw new BoqLimitExceededError(breaches);
    }

    const grossCurrentAmount = sumMoney(lines.map((line) => line.totalCurrentAmount));
    const grossCumulativeAmount = money(previousGrossAmount.plus(grossCurrentAmount));

    const remainingAdvanceBalanceBefore = moneyMaxZero(
      money(subcontract.advancePaymentTotal).minus(previouslyRecoveredAdvance)
    );
    const advanceCap = money(grossCurrentAmount.mul(rate(subcontract.advancePaymentRecoveryRate)));
    const advancePaymentDeduction =
      remainingAdvanceBalanceBefore.gt(0) && grossCurrentAmount.gt(0)
        ? moneyMin(remainingAdvanceBalanceBefore, advanceCap)
        : moneyZero();
    const remainingAdvanceBalanceAfter = moneyMaxZero(
      remainingAdvanceBalanceBefore.minus(advancePaymentDeduction)
    );

    const retentionDeduction = money(grossCurrentAmount.mul(rate(subcontract.retentionRate)));
    const taxWithholdingDeduction = money(
      grossCurrentAmount.mul(rate(subcontract.taxWithholdingRate))
    );
    const socialInsuranceDeduction = money(
      grossCurrentAmount.mul(rate(subcontract.socialInsuranceRate))
    );

    const pendingPenalties = await db.sitePenaltyAndSnag.findMany({
      where: {
        subcontractId: subcontract.id,
        subcontract: { companyId: params.companyId },
        OR: [
          { subcontractInvoiceId: null, status: 'APPROVED_FOR_DEDUCTION' },
          ...(params.excludeInvoiceId
            ? [{ subcontractInvoiceId: params.excludeInvoiceId }]
            : []),
        ],
      },
      select: { id: true, amount: true },
    });

    const pendingMaterials = await db.materialReconciliationLog.findMany({
      where: {
        subcontractId: subcontract.id,
        subcontract: { companyId: params.companyId },
        OR: [
          { subcontractInvoiceId: null, status: 'PENDING_DEDUCTION' },
          ...(params.excludeInvoiceId
            ? [{ subcontractInvoiceId: params.excludeInvoiceId }]
            : []),
        ],
      },
      select: { id: true, totalPenaltyAmount: true },
    });

    const pendingDirect = await db.directExecutionCharge.findMany({
      where: {
        subcontractId: subcontract.id,
        subcontract: { companyId: params.companyId },
        OR: [
          { subcontractInvoiceId: null, status: 'PENDING' },
          ...(params.excludeInvoiceId
            ? [{ subcontractInvoiceId: params.excludeInvoiceId }]
            : []),
        ],
      },
      select: { id: true, totalDeduction: true },
    });

    const sitePenaltiesDeduction = sumMoney(pendingPenalties.map((row) => row.amount));
    const materialOveruseDeduction = sumMoney(pendingMaterials.map((row) => row.totalPenaltyAmount));
    const directExecutionDeduction = sumMoney(pendingDirect.map((row) => row.totalDeduction));
    const applyEarlyPaymentDiscount = Boolean(params.applyEarlyPaymentDiscount);
    const earlyPaymentDiscountDeduction = applyEarlyPaymentDiscount
      ? money(grossCurrentAmount.mul(rate(subcontract.earlyPaymentDiscountRate)))
      : moneyZero();

    const totalDeductions = sumMoney([
      advancePaymentDeduction,
      retentionDeduction,
      taxWithholdingDeduction,
      socialInsuranceDeduction,
      materialOveruseDeduction,
      sitePenaltiesDeduction,
      directExecutionDeduction,
      earlyPaymentDiscountDeduction,
    ]);
    const netPayableAmount = money(grossCurrentAmount.minus(totalDeductions));

    return {
      subcontractId: subcontract.id,
      previousGrossAmount,
      grossCurrentAmount,
      grossCumulativeAmount,
      deductions: {
        advancePaymentDeduction,
        remainingAdvanceBalanceBefore,
        remainingAdvanceBalanceAfter,
        retentionDeduction,
        taxWithholdingDeduction,
        socialInsuranceDeduction,
        materialOveruseDeduction,
        sitePenaltiesDeduction,
        directExecutionDeduction,
        earlyPaymentDiscountDeduction,
      },
      netPayableAmount,
      lines,
      pendingMaterialLogIds: pendingMaterials.map((row) => row.id),
      pendingPenaltyIds: pendingPenalties.map((row) => row.id),
      pendingDirectChargeIds: pendingDirect.map((row) => row.id),
      applyEarlyPaymentDiscount,
    };
  }
}

function moneyMaxZero(value: ReturnType<typeof money>) {
  return value.gte(0) ? value : moneyZero();
}

export const subcontractInvoiceCalculationService = new SubcontractInvoiceCalculationService();
