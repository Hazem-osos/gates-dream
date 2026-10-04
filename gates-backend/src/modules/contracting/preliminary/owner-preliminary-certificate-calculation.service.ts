import type { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  ClientBoqLimitExceededError,
  ClientContractNotFoundError,
  type ClientBoqLimitExceededDetail,
} from '../client-billing/errors/client-billing-domain.errors';
import { clientInvoiceCalculationService } from '../client-billing/services/client-invoice-calculation.service';
import { money, moneyZero, sumMoney } from '../utils/money-decimal';
import { sumPreviousOwnerCertifiedQuantityInTx } from './preliminary-quantity-baseline.service';
import {
  resolveEffectiveOwnerBoqQuantityInTx,
  resolveEffectiveOwnerBoqRateInTx,
} from '../variation/contract-variation-effective.service';

type Db = Prisma.TransactionClient;

export type OwnerPrelimLineInput = {
  projectBOQItemId: string;
  requestedCurrentQuantity: number;
  approvedCurrentQuantity?: number | null;
};

export type CalculatedOwnerPrelimLine = {
  projectBOQItemId: string;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  contractQuantitySnapshot: ReturnType<typeof money>;
  unitRateSnapshot: ReturnType<typeof money>;
  originalContractQuantity?: ReturnType<typeof money>;
  approvedVariationQuantityDelta?: ReturnType<typeof money>;
  previousCertifiedQuantity: ReturnType<typeof money>;
  requestedCurrentQuantity: ReturnType<typeof money>;
  approvedCurrentQuantity: ReturnType<typeof money> | null;
  cumulativeApprovedQuantity: ReturnType<typeof money>;
  remainingQuantity: ReturnType<typeof money>;
  currentAmount: ReturnType<typeof money>;
  cumulativeAmount: ReturnType<typeof money>;
};

export type CalculatedOwnerPreliminary = {
  lines: CalculatedOwnerPrelimLine[];
  grossCurrentWorks: ReturnType<typeof money>;
  previousGrossWorks: ReturnType<typeof money>;
  cumulativeGrossWorks: ReturnType<typeof money>;
  materialsOnSiteCurrent: ReturnType<typeof money>;
  materialsOnSiteDeduction: ReturnType<typeof money>;
  advancePaymentRecovery: ReturnType<typeof money>;
  retentionDeduction: ReturnType<typeof money>;
  engineeringStampsDeduction: ReturnType<typeof money>;
  otherClientPenalties: ReturnType<typeof money>;
  netPayablePreview: ReturnType<typeof money>;
};

export class OwnerPreliminaryCertificateCalculationService {
  async calculateInTx(
    db: Db,
    companyId: string,
    clientContractId: string,
    input: {
      lines: OwnerPrelimLineInput[];
      otherClientPenalties?: number;
      excludePreliminaryCertificateId?: string;
      useApprovedQuantities?: boolean;
    }
  ): Promise<CalculatedOwnerPreliminary> {
    const contract = await db.clientContract.findFirst({ where: { id: clientContractId, companyId } });
    if (!contract) throw new ClientContractNotFoundError(companyId, clientContractId);

    const boqItems = await db.projectBOQItem.findMany({
      where: { companyId, projectId: contract.projectId },
    });
    const boqById = new Map(boqItems.map((b) => [b.id, b]));

    const breaches: ClientBoqLimitExceededDetail[] = [];
    const lines: CalculatedOwnerPrelimLine[] = [];

    for (const row of input.lines) {
      const boq = boqById.get(row.projectBOQItemId);
      if (!boq) throw new AppError(400, `BOQ item not on project: ${row.projectBOQItemId}`);

      const previousCertifiedQuantity = await sumPreviousOwnerCertifiedQuantityInTx(
        db,
        companyId,
        clientContractId,
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
      if (qtyForCumulative.lt(0)) {
        throw new AppError(400, `Approved quantity cannot be negative for ${boq.itemCode}`);
      }

      const cumulativeApprovedQuantity = money(previousCertifiedQuantity.plus(qtyForCumulative));
      const originalContractQuantity = money(boq.contractQuantity);
      const contractQuantitySnapshot = await resolveEffectiveOwnerBoqQuantityInTx(
        db,
        companyId,
        clientContractId,
        boq.id
      );
      const approvedVariationQuantityDelta = money(
        contractQuantitySnapshot.minus(originalContractQuantity)
      );
      const remainingQuantity = moneyMax(contractQuantitySnapshot.minus(cumulativeApprovedQuantity));

      if (cumulativeApprovedQuantity.gt(contractQuantitySnapshot)) {
        breaches.push({
          projectBOQItemId: boq.id,
          itemCode: boq.itemCode,
          previousQuantity: previousCertifiedQuantity.toFixed(4),
          currentQuantity: qtyForCumulative.toFixed(4),
          cumulativeQuantity: cumulativeApprovedQuantity.toFixed(4),
          contractQuantity: contractQuantitySnapshot.toFixed(4),
        });
      }

      const unitRateSnapshot = await resolveEffectiveOwnerBoqRateInTx(
        db,
        companyId,
        clientContractId,
        boq.id
      );
      const currentQtyForAmount = approvedCurrentQuantity ?? requestedCurrentQuantity;
      const currentAmount = money(currentQtyForAmount.mul(unitRateSnapshot));
      const cumulativeAmount = money(cumulativeApprovedQuantity.mul(unitRateSnapshot));

      lines.push({
        projectBOQItemId: boq.id,
        itemCodeSnapshot: boq.itemCode,
        descriptionArSnapshot: boq.descriptionAr,
        unitSnapshot: boq.unit,
        contractQuantitySnapshot,
        unitRateSnapshot,
        originalContractQuantity,
        approvedVariationQuantityDelta,
        previousCertifiedQuantity,
        requestedCurrentQuantity,
        approvedCurrentQuantity,
        cumulativeApprovedQuantity,
        remainingQuantity,
        currentAmount,
        cumulativeAmount,
      });
    }

    if (breaches.length) throw new ClientBoqLimitExceededError(breaches);

    const grossCurrentWorks = sumMoney(lines.map((l) => l.currentAmount));
    const previousGrossWorks = sumMoney(
      lines.map((l) => money(l.previousCertifiedQuantity.mul(l.unitRateSnapshot)))
    );
    const cumulativeGrossWorks = sumMoney(lines.map((l) => l.cumulativeAmount));

    const financialPreview = await clientInvoiceCalculationService.calculateDraftClientInvoiceInTx(
      db,
      companyId,
      clientContractId,
      {
        items: lines.map((l) => ({
          projectBOQItemId: l.projectBOQItemId,
          currentQuantity: (l.approvedCurrentQuantity ?? l.requestedCurrentQuantity).toFixed(4),
        })),
        otherClientPenalties: input.otherClientPenalties,
        allowVariationOrder: false,
        excludePreliminaryCertificateId: input.excludePreliminaryCertificateId,
      }
    );

    return {
      lines,
      grossCurrentWorks,
      previousGrossWorks,
      cumulativeGrossWorks,
      materialsOnSiteCurrent: financialPreview.materials.materialsOnSiteCurrent,
      materialsOnSiteDeduction: financialPreview.materials.materialsOnSiteDeduction,
      advancePaymentRecovery: financialPreview.deductions.advancePaymentRecovery,
      retentionDeduction: financialPreview.deductions.retentionDeduction,
      engineeringStampsDeduction: financialPreview.deductions.engineeringStampsDeduction,
      otherClientPenalties: financialPreview.deductions.otherClientPenalties,
      netPayablePreview: financialPreview.netPayableByClient,
    };
  }
}

function moneyMax(value: ReturnType<typeof money>) {
  return value.lt(0) ? moneyZero() : value;
}

export const ownerPreliminaryCertificateCalculationService =
  new OwnerPreliminaryCertificateCalculationService();
