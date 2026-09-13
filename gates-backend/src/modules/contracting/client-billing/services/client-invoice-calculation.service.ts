import type { Prisma, SiteStockMaterial } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { money, moneyMin, moneyMaxZero, moneyZero, rate, sumMoney } from '../../utils/money-decimal';
import {
  ClientBoqLimitExceededError,
  ClientContractNotFoundError,
  type ClientBoqLimitExceededDetail,
} from '../errors/client-billing-domain.errors';
import type {
  CalculateDraftClientInvoiceDto,
  CalculatedClientInvoiceLine,
  CalculatedDraftClientInvoice,
  CalculatedMaterialsOnSite,
} from '../types/client-invoice.types';
import { HISTORICAL_CLIENT_INVOICE_STATUSES } from '../types/client-invoice.types';

type Db = Prisma.TransactionClient | typeof prisma;

export class ClientInvoiceCalculationService {
  async calculateDraftClientInvoice(
    companyId: string,
    clientContractId: string,
    dto: CalculateDraftClientInvoiceDto
  ): Promise<CalculatedDraftClientInvoice> {
    return this.calculateDraftClientInvoiceInTx(prisma, companyId, clientContractId, dto);
  }

  async calculateDraftClientInvoiceInTx(
    db: Db,
    companyId: string,
    clientContractId: string,
    dto: CalculateDraftClientInvoiceDto
  ): Promise<CalculatedDraftClientInvoice> {
    const contract = await db.clientContract.findFirst({
      where: { id: clientContractId, companyId },
    });
    if (!contract) throw new ClientContractNotFoundError(companyId, clientContractId);

    const seen = new Set<string>();
    for (const line of dto.items) {
      if (seen.has(line.projectBOQItemId)) {
        throw new AppError(400, `Duplicate owner BOQ item on invoice: ${line.projectBOQItemId}`);
      }
      seen.add(line.projectBOQItemId);
    }

    const boqItems = await db.projectBOQItem.findMany({
      where: { companyId, projectId: contract.projectId },
    });
    const boqById = new Map(boqItems.map((row) => [row.id, row]));

    const priorInvoices = await db.clientInvoice.findMany({
      where: {
        companyId,
        clientContractId,
        status: { in: [...HISTORICAL_CLIENT_INVOICE_STATUSES] },
        ...(dto.excludeInvoiceId ? { id: { not: dto.excludeInvoiceId } } : {}),
      },
      include: { items: true },
      orderBy: { sequenceNumber: 'asc' },
    });

    const previousQtyByBoq = new Map<string, ReturnType<typeof money>>();
    for (const invoice of priorInvoices) {
      for (const item of invoice.items) {
        const prev = previousQtyByBoq.get(item.projectBOQItemId) ?? moneyZero();
        previousQtyByBoq.set(item.projectBOQItemId, money(prev.plus(item.currentQuantity)));
      }
    }

    const previousGrossWorks = sumMoney(priorInvoices.map((row) => row.grossCurrentWorks));
    const previouslyRecoveredAdvance = sumMoney(
      priorInvoices.map((row) => row.advancePaymentRecovery)
    );

    const breaches: ClientBoqLimitExceededDetail[] = [];
    const lines: CalculatedClientInvoiceLine[] = [];

    for (const input of dto.items) {
      const boq = boqById.get(input.projectBOQItemId);
      if (!boq) {
        throw new AppError(400, `Owner BOQ item ${input.projectBOQItemId} is not on this project`);
      }

      const previousQuantity = previousQtyByBoq.get(boq.id) ?? moneyZero();
      const currentQuantity = money(input.currentQuantity);
      if (currentQuantity.lt(0)) {
        throw new AppError(400, `Current quantity cannot be negative for ${boq.itemCode}`);
      }

      const cumulativeQuantity = money(previousQuantity.plus(currentQuantity));
      const contractQuantity = money(boq.contractQuantity);
      const unitSellingPrice = money(boq.unitSellingPrice);
      const currentAmount = money(currentQuantity.mul(unitSellingPrice));

      if (!dto.allowVariationOrder && cumulativeQuantity.gt(contractQuantity)) {
        breaches.push({
          projectBOQItemId: boq.id,
          itemCode: boq.itemCode,
          previousQuantity: previousQuantity.toFixed(4),
          currentQuantity: currentQuantity.toFixed(4),
          cumulativeQuantity: cumulativeQuantity.toFixed(4),
          contractQuantity: contractQuantity.toFixed(4),
        });
      }

      lines.push({
        projectBOQItemId: boq.id,
        itemCode: boq.itemCode,
        previousQuantity,
        currentQuantity,
        cumulativeQuantity,
        unitSellingPrice,
        currentAmount,
        contractQuantity,
      });
    }

    if (breaches.length) {
      throw new ClientBoqLimitExceededError(breaches);
    }

    const grossCurrentWorks = sumMoney(lines.map((line) => line.currentAmount));
    const cumulativeGrossWorks = money(previousGrossWorks.plus(grossCurrentWorks));

    const materials = await this.computeMaterialsOnSite(db, {
      companyId,
      projectId: contract.projectId,
      excludeInvoiceId: dto.excludeInvoiceId,
      claimSiteStockMaterialIds: dto.claimSiteStockMaterialIds,
      installSiteStockMaterialIds: dto.installSiteStockMaterialIds,
    });

    const remainingAdvanceBalanceBefore = moneyMaxZero(
      money(contract.advancePaymentAmount).minus(previouslyRecoveredAdvance)
    );
    const advanceCap = money(grossCurrentWorks.mul(rate(contract.advanceRecoveryRate)));
    const advancePaymentRecovery =
      remainingAdvanceBalanceBefore.gt(0) && grossCurrentWorks.gt(0)
        ? moneyMin(remainingAdvanceBalanceBefore, advanceCap)
        : moneyZero();
    const remainingAdvanceBalanceAfter = moneyMaxZero(
      remainingAdvanceBalanceBefore.minus(advancePaymentRecovery)
    );

    const retentionDeduction = money(grossCurrentWorks.mul(rate(contract.retentionRate)));
    const engineeringStampsDeduction = money(
      grossCurrentWorks.mul(rate(contract.engineeringStampsRate))
    );
    const otherClientPenalties = money(dto.otherClientPenalties ?? 0);
    if (otherClientPenalties.lt(0)) {
      throw new AppError(400, 'otherClientPenalties cannot be negative');
    }

    const totalDeductions = sumMoney([
      advancePaymentRecovery,
      retentionDeduction,
      engineeringStampsDeduction,
      otherClientPenalties,
    ]);
    const netPayableByClient = money(
      grossCurrentWorks.plus(materials.netMaterialsOnSite).minus(totalDeductions)
    );

    return {
      clientContractId: contract.id,
      projectId: contract.projectId,
      previousGrossWorks,
      grossCurrentWorks,
      cumulativeGrossWorks,
      materials,
      deductions: {
        advancePaymentRecovery,
        remainingAdvanceBalanceBefore,
        remainingAdvanceBalanceAfter,
        retentionDeduction,
        engineeringStampsDeduction,
        otherClientPenalties,
      },
      netPayableByClient,
      lines,
    };
  }

  async computeMaterialsOnSite(
    db: Db,
    params: {
      companyId: string;
      projectId: string;
      excludeInvoiceId?: string;
      claimSiteStockMaterialIds?: string[];
      installSiteStockMaterialIds?: string[];
    }
  ): Promise<CalculatedMaterialsOnSite> {
    const stock = await db.siteStockMaterial.findMany({
      where: { companyId: params.companyId, projectId: params.projectId },
    });

    const installSet = new Set(params.installSiteStockMaterialIds ?? []);
    const claimFilter = params.claimSiteStockMaterialIds
      ? new Set(params.claimSiteStockMaterialIds)
      : null;

    const claimed: SiteStockMaterial[] = [];
    const installed: SiteStockMaterial[] = [];

    for (const row of stock) {
      if (row.status === 'REJECTED') continue;

      const linkedToThisDraft =
        params.excludeInvoiceId != null && row.clientInvoiceId === params.excludeInvoiceId;

      if (installSet.has(row.id)) {
        installed.push(row);
        continue;
      }

      const isStored = row.status === 'STORED_ON_SITE';
      const unlinkedOrThisDraft = row.clientInvoiceId == null || linkedToThisDraft;
      if (!isStored || !unlinkedOrThisDraft) continue;
      if (claimFilter && !claimFilter.has(row.id)) continue;
      claimed.push(row);
    }

    const materialsOnSiteCurrent = sumMoney(claimed.map(claimedAmount));
    const materialsOnSiteDeduction = sumMoney(installed.map(claimedAmount));

    return {
      materialsOnSiteCurrent,
      materialsOnSiteDeduction,
      netMaterialsOnSite: money(materialsOnSiteCurrent.minus(materialsOnSiteDeduction)),
      claimedMaterialIds: claimed.map((row) => row.id),
      installedMaterialIds: installed.map((row) => row.id),
    };
  }
}

function claimedAmount(row: SiteStockMaterial) {
  if (row.netClaimedAmount != null && money(row.netClaimedAmount).gt(0)) {
    return money(row.netClaimedAmount);
  }
  return money(money(row.deliveredQuantity).mul(money(row.unitPrice)).mul(rate(row.approvedPercentage)));
}

export const clientInvoiceCalculationService = new ClientInvoiceCalculationService();
