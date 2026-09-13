import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import {
  MaterialItemNotFoundError,
  SubcontractNotFoundError,
} from '../errors/subcontract-domain.errors';
import type {
  CalculateMaterialOveruseParams,
  MaterialOverusePenaltyResult,
} from '../types/subcontract-invoice.types';
import { money, moneyZero, rate, toDecimal } from '../utils/money-decimal';

type Db = Prisma.TransactionClient | typeof prisma;

export class MaterialReconciliationService {
  async calculateMaterialOverusePenalty(
    params: CalculateMaterialOveruseParams
  ): Promise<MaterialOverusePenaltyResult> {
    return prisma.$transaction((tx) => this.calculateMaterialOverusePenaltyInTx(tx, params));
  }

  async calculateMaterialOverusePenaltyInTx(
    db: Db,
    params: CalculateMaterialOveruseParams
  ): Promise<MaterialOverusePenaltyResult> {
    const subcontract = await db.subcontract.findFirst({
      where: { id: params.subcontractId, companyId: params.companyId },
    });
    if (!subcontract) {
      throw new SubcontractNotFoundError(params.companyId, params.subcontractId);
    }

    const item = await db.item.findFirst({
      where: { id: params.materialId, companyId: params.companyId },
      select: { id: true },
    });
    if (!item) {
      throw new MaterialItemNotFoundError(params.companyId, params.materialId);
    }

    const standardEngineeredQty = money(params.standardEngineeredQty);
    const actualIssuedQty = money(params.actualIssuedQty);
    const marketPricePerUnit = money(params.marketPricePerUnit);
    const scrapTolerance = rate(subcontract.standardScrapToleranceRate);
    const overheadRate = rate(subcontract.contractAdminOverheadRate);

    const allowedThreshold = money(standardEngineeredQty.mul(toDecimal(1).plus(scrapTolerance)));

    let scrapExcessQty = moneyZero();
    let rawPenalty = moneyZero();
    let overheadAmount = moneyZero();
    let totalPenaltyAmount = moneyZero();

    if (actualIssuedQty.gt(allowedThreshold)) {
      scrapExcessQty = money(actualIssuedQty.minus(allowedThreshold));
      rawPenalty = money(scrapExcessQty.mul(marketPricePerUnit));
      overheadAmount = money(rawPenalty.mul(overheadRate));
      totalPenaltyAmount = money(rawPenalty.plus(overheadAmount));
    }

    const log = await db.materialReconciliationLog.create({
      data: {
        subcontractId: subcontract.id,
        itemId: item.id,
        warehouseIssueSlipNumber: params.warehouseIssueSlipNumber ?? null,
        standardEngineeredQty,
        actualIssuedQty,
        scrapExcessQty,
        marketPricePerUnit,
        adminOverheadPercentage: overheadRate,
        totalPenaltyAmount,
        status: 'PENDING_DEDUCTION',
      },
    });

    return {
      subcontractId: subcontract.id,
      itemId: item.id,
      warehouseIssueSlipNumber: log.warehouseIssueSlipNumber,
      standardEngineeredQty,
      actualIssuedQty,
      allowedThreshold,
      scrapExcessQty,
      rawPenalty,
      overheadAmount,
      adminOverheadPercentage: overheadRate,
      totalPenaltyAmount,
      logId: log.id,
    };
  }
}

export const materialReconciliationService = new MaterialReconciliationService();
