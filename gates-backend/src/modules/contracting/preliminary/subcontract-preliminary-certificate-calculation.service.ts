import type { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  BoqLimitExceededError,
  SubcontractNotFoundError,
  type BoqLimitExceededDetail,
} from '../../subcontracts/errors/subcontract-domain.errors';
import { subcontractInvoiceCalculationService } from '../../subcontracts/services/subcontract-invoice-calculation.service';
import { money, moneyZero, sumMoney } from '../utils/money-decimal';
import { sumPreviousSubCertifiedQuantityInTx } from './preliminary-quantity-baseline.service';
import {
  resolveEffectiveSubcontractBoqQuantityInTx,
  resolveEffectiveSubcontractBoqRateInTx,
  sumApprovedSubcontractQuantityDelta,
  loadApprovedSubcontractVariationLinesInTx,
} from '../variation/contract-variation-effective.service';

type Db = Prisma.TransactionClient;

export type SubPrelimLineInput = {
  subcontractBOQItemId: string;
  requestedCurrentQuantity: number;
  approvedCurrentQuantity?: number | null;
};

export type CalculatedSubPrelimLine = {
  subcontractBOQItemId: string;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  contractQuantitySnapshot: ReturnType<typeof money>;
  maxAllowedQuantitySnapshot: ReturnType<typeof money>;
  unitRateSnapshot: ReturnType<typeof money>;
  previousCertifiedQuantity: ReturnType<typeof money>;
  requestedCurrentQuantity: ReturnType<typeof money>;
  approvedCurrentQuantity: ReturnType<typeof money> | null;
  cumulativeApprovedQuantity: ReturnType<typeof money>;
  remainingQuantity: ReturnType<typeof money>;
  currentAmount: ReturnType<typeof money>;
  cumulativeAmount: ReturnType<typeof money>;
};

export type CalculatedSubPreliminary = {
  lines: CalculatedSubPrelimLine[];
  grossCurrentAmount: ReturnType<typeof money>;
  previousGrossAmount: ReturnType<typeof money>;
  grossCumulativeAmount: ReturnType<typeof money>;
  advancePaymentDeduction: ReturnType<typeof money>;
  retentionDeduction: ReturnType<typeof money>;
  taxWithholdingDeduction: ReturnType<typeof money>;
  socialInsuranceDeduction: ReturnType<typeof money>;
  materialOveruseDeduction: ReturnType<typeof money>;
  sitePenaltiesDeduction: ReturnType<typeof money>;
  directExecutionDeduction: ReturnType<typeof money>;
  earlyPaymentDiscountDeduction: ReturnType<typeof money>;
  netPayablePreview: ReturnType<typeof money>;
};

export class SubcontractPreliminaryCertificateCalculationService {
  async calculateInTx(
    db: Db,
    companyId: string,
    subcontractId: string,
    input: {
      lines: SubPrelimLineInput[];
      applyEarlyPaymentDiscount?: boolean;
      excludePreliminaryCertificateId?: string;
      useApprovedQuantities?: boolean;
    }
  ): Promise<CalculatedSubPreliminary> {
    const subcontract = await db.subcontract.findFirst({
      where: { id: subcontractId, companyId },
      include: { boqItems: true },
    });
    if (!subcontract) throw new SubcontractNotFoundError(companyId, subcontractId);

    const boqById = new Map(subcontract.boqItems.map((b) => [b.id, b]));
    const approvedVariationLines = await loadApprovedSubcontractVariationLinesInTx(
      db,
      companyId,
      subcontractId
    );
    const breaches: BoqLimitExceededDetail[] = [];
    const lines: CalculatedSubPrelimLine[] = [];

    for (const row of input.lines) {
      const boq = boqById.get(row.subcontractBOQItemId);
      if (!boq) throw new AppError(400, `BOQ item not on subcontract: ${row.subcontractBOQItemId}`);

      const previousCertifiedQuantity = await sumPreviousSubCertifiedQuantityInTx(
        db,
        companyId,
        subcontractId,
        boq.id,
        input.excludePreliminaryCertificateId
      );
      const requestedCurrentQuantity = money(row.requestedCurrentQuantity);
      if (requestedCurrentQuantity.lt(0)) {
        throw new AppError(400, `Requested quantity cannot be negative for ${boq.itemCode}`);
      }

      const approvedCurrentQuantity =
        input.useApprovedQuantities && row.approvedCurrentQuantity != null
          ? money(row.approvedCurrentQuantity)
          : null;

      const qtyForCumulative = approvedCurrentQuantity ?? requestedCurrentQuantity;
      const cumulativeApprovedQuantity = money(previousCertifiedQuantity.plus(qtyForCumulative));
      const contractQuantitySnapshot = await resolveEffectiveSubcontractBoqQuantityInTx(
        db,
        companyId,
        subcontractId,
        boq.id
      );
      const qtyDelta = sumApprovedSubcontractQuantityDelta(approvedVariationLines, boq.id);
      const maxAllowedQuantitySnapshot = money(money(boq.maxAllowedQuantity).plus(qtyDelta));
      const remainingQuantity = moneyMax(maxAllowedQuantitySnapshot.minus(cumulativeApprovedQuantity));

      if (cumulativeApprovedQuantity.gt(maxAllowedQuantitySnapshot)) {
        breaches.push({
          subcontractBOQItemId: boq.id,
          itemCode: boq.itemCode,
          previousQuantity: previousCertifiedQuantity.toFixed(4),
          currentQuantity: qtyForCumulative.toFixed(4),
          totalCumulativeQuantity: cumulativeApprovedQuantity.toFixed(4),
          maxAllowedQuantity: maxAllowedQuantitySnapshot.toFixed(4),
        });
      }

      const unitRateSnapshot = await resolveEffectiveSubcontractBoqRateInTx(
        db,
        companyId,
        subcontractId,
        boq.id
      );
      const currentQtyForAmount = approvedCurrentQuantity ?? requestedCurrentQuantity;
      const currentAmount = money(currentQtyForAmount.mul(unitRateSnapshot));
      const cumulativeAmount = money(cumulativeApprovedQuantity.mul(unitRateSnapshot));

      lines.push({
        subcontractBOQItemId: boq.id,
        itemCodeSnapshot: boq.itemCode,
        descriptionArSnapshot: boq.descriptionAr,
        unitSnapshot: boq.unit,
        contractQuantitySnapshot,
        maxAllowedQuantitySnapshot,
        unitRateSnapshot,
        previousCertifiedQuantity,
        requestedCurrentQuantity,
        approvedCurrentQuantity,
        cumulativeApprovedQuantity,
        remainingQuantity,
        currentAmount,
        cumulativeAmount,
      });
    }

    if (breaches.length) throw new BoqLimitExceededError(breaches);

    const grossCurrentAmount = sumMoney(lines.map((l) => l.currentAmount));
    const previousGrossAmount = sumMoney(
      lines.map((l) => money(l.previousCertifiedQuantity.mul(l.unitRateSnapshot)))
    );
    const grossCumulativeAmount = sumMoney(lines.map((l) => l.cumulativeAmount));

    const financialPreview = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(db, {
      companyId,
      subcontractId,
      items: lines.map((l) => ({
        subcontractBOQItemId: l.subcontractBOQItemId,
        currentQuantity: (l.approvedCurrentQuantity ?? l.requestedCurrentQuantity).toFixed(4),
      })),
      applyEarlyPaymentDiscount: input.applyEarlyPaymentDiscount,
      excludePreliminaryCertificateId: input.excludePreliminaryCertificateId,
    });

    return {
      lines,
      grossCurrentAmount,
      previousGrossAmount,
      grossCumulativeAmount,
      advancePaymentDeduction: financialPreview.deductions.advancePaymentDeduction,
      retentionDeduction: financialPreview.deductions.retentionDeduction,
      taxWithholdingDeduction: financialPreview.deductions.taxWithholdingDeduction,
      socialInsuranceDeduction: financialPreview.deductions.socialInsuranceDeduction,
      materialOveruseDeduction: financialPreview.deductions.materialOveruseDeduction,
      sitePenaltiesDeduction: financialPreview.deductions.sitePenaltiesDeduction,
      directExecutionDeduction: financialPreview.deductions.directExecutionDeduction,
      earlyPaymentDiscountDeduction: financialPreview.deductions.earlyPaymentDiscountDeduction,
      netPayablePreview: financialPreview.netPayableAmount,
    };
  }
}

function moneyMax(value: ReturnType<typeof money>) {
  return value.lt(0) ? moneyZero() : value;
}

export const subcontractPreliminaryCertificateCalculationService =
  new SubcontractPreliminaryCertificateCalculationService();
