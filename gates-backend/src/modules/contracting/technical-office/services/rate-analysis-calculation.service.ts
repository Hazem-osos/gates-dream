import type { BOQCostElementType, Prisma } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { money, moneyZero, rate, sumMoney, toDecimal } from '../../utils/money-decimal';
import {
  ProjectBOQItemNotFoundError,
  RateAnalysisEmptyError,
} from '../errors/technical-office-domain.errors';
import type {
  BoqItemSellingPriceResult,
  CalculatedRateAnalysisElement,
  DirectUnitCostResult,
  MarkupRates,
  RateAnalysisElementInput,
} from '../types/rate-analysis.types';

const ELEMENT_TYPES: BOQCostElementType[] = [
  'MATERIAL',
  'LABOR',
  'EQUIPMENT',
  'SUBCONTRACTOR',
  'SITE_EXPENSE',
];

type Db = Prisma.TransactionClient | typeof prisma;

const DEFAULT_MARKUP: Omit<MarkupRates, 'source'> = {
  generalOverheadRate: rate(0.08),
  siteOverheadRate: rate(0.05),
  contingencyRiskRate: rate(0.03),
  profitMarginRate: rate(0.12),
  contractTaxesRate: rate(0),
};

export class RateAnalysisCalculationService {
  calculateDirectUnitCost(
    boqItemId: string,
    items: RateAnalysisElementInput[]
  ): DirectUnitCostResult {
    const byElementType = emptyElementTotals();
    const elements: CalculatedRateAnalysisElement[] = items.map((item) => {
      const computed = this.elementCost(item);
      byElementType[item.costElementType] = money(
        byElementType[item.costElementType].plus(computed.elementCost)
      );
      return computed;
    });

    return {
      boqItemId,
      elements,
      byElementType,
      totalDirectCost: sumMoney(elements.map((row) => row.elementCost)),
    };
  }

  async computeBoqItemSellingPrice(
    companyId: string,
    boqItemId: string
  ): Promise<BoqItemSellingPriceResult> {
    return prisma.$transaction((tx) => this.computeBoqItemSellingPriceInTx(tx, companyId, boqItemId));
  }

  async computeBoqItemSellingPriceInTx(
    db: Db,
    companyId: string,
    boqItemId: string
  ): Promise<BoqItemSellingPriceResult> {
    const boq = await db.projectBOQItem.findFirst({
      where: { id: boqItemId, companyId },
      include: { rateAnalysisItems: true, markupStructures: true },
    });
    if (!boq) throw new ProjectBOQItemNotFoundError(companyId, boqItemId);
    if (!boq.rateAnalysisItems.length) throw new RateAnalysisEmptyError(boqItemId);

    const direct = this.calculateDirectUnitCost(boq.id, boq.rateAnalysisItems);
    const markup = await this.resolveMarkup(db, companyId, boq.id, boq.projectId, boq.markupStructures);

    const overheadMultiplier = money(
      toDecimal(1)
        .plus(markup.generalOverheadRate)
        .plus(markup.siteOverheadRate)
        .plus(markup.contingencyRiskRate)
    );
    const costWithOverhead = money(direct.totalDirectCost.mul(overheadMultiplier));
    const unitSellingPrice = money(
      costWithOverhead.mul(toDecimal(1).plus(markup.profitMarginRate)).mul(
        toDecimal(1).plus(markup.contractTaxesRate)
      )
    );
    const contractQuantity = money(boq.contractQuantity);
    const totalSellingPrice = money(unitSellingPrice.mul(contractQuantity));
    const compositeMarkupRate = rate(
      unitSellingPrice.div(direct.totalDirectCost.gt(0) ? direct.totalDirectCost : toDecimal(1)).minus(1)
    );

    await Promise.all(
      boq.rateAnalysisItems.map((row, index) =>
        db.bOQRateAnalysisItem.update({
          where: { id: row.id },
          data: { totalCostPerUnit: direct.elements[index].elementCost },
        })
      )
    );

    await db.projectBOQItem.update({
      where: { id: boq.id },
      data: {
        directCostEstimated: direct.totalDirectCost,
        unitSellingPrice,
        totalSellingPrice,
        indirectMarkupRate: compositeMarkupRate.gte(0) ? compositeMarkupRate : rate(0),
        status: 'PRICED',
      },
    });

    return {
      boqItemId: boq.id,
      companyId,
      directCostEstimated: direct.totalDirectCost,
      overheadMultiplier,
      costWithOverhead,
      unitSellingPrice,
      totalSellingPrice,
      contractQuantity,
      compositeMarkupRate,
      status: 'PRICED',
      markup,
      direct,
    };
  }

  private elementCost(item: RateAnalysisElementInput): CalculatedRateAnalysisElement {
    const consumptionQuotaPerUnit = money(item.consumptionQuotaPerUnit);
    const wasteFactorRate = rate(item.wasteFactorRate ?? 0);
    const unitCost = money(item.unitCost);
    const elementCost = money(
      consumptionQuotaPerUnit.mul(toDecimal(1).plus(wasteFactorRate)).mul(unitCost)
    );
    return {
      costElementType: item.costElementType,
      resourceCode: item.resourceCode ?? null,
      descriptionAr: item.descriptionAr ?? null,
      consumptionQuotaPerUnit,
      wasteFactorRate,
      unitCost,
      elementCost,
    };
  }

  private async resolveMarkup(
    db: Db,
    companyId: string,
    boqItemId: string,
    projectId: string,
    itemLevel: { generalOverheadRate: unknown }[]
  ): Promise<MarkupRates> {
    if (itemLevel.length) {
      const row = await db.bOQMarkupStructure.findFirst({
        where: { companyId, projectBOQItemId: boqItemId },
        orderBy: { updatedAt: 'desc' },
      });
      if (row) return this.markupFromRow(row, 'ITEM');
    }

    const projectRow = await db.bOQMarkupStructure.findFirst({
      where: { companyId, projectId, projectBOQItemId: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (projectRow) return this.markupFromRow(projectRow, 'PROJECT');

    return { ...DEFAULT_MARKUP, source: 'DEFAULT' };
  }

  private markupFromRow(
    row: {
      generalOverheadRate: unknown;
      siteOverheadRate: unknown;
      contingencyRiskRate: unknown;
      profitMarginRate: unknown;
      contractTaxesRate: unknown;
    },
    source: MarkupRates['source']
  ): MarkupRates {
    return {
      generalOverheadRate: rate(row.generalOverheadRate as DecimalInputLike),
      siteOverheadRate: rate(row.siteOverheadRate as DecimalInputLike),
      contingencyRiskRate: rate(row.contingencyRiskRate as DecimalInputLike),
      profitMarginRate: rate(row.profitMarginRate as DecimalInputLike),
      contractTaxesRate: rate(row.contractTaxesRate as DecimalInputLike),
      source,
    };
  }
}

type DecimalInputLike = Parameters<typeof rate>[0];

function emptyElementTotals(): Record<BOQCostElementType, ReturnType<typeof money>> {
  return Object.fromEntries(ELEMENT_TYPES.map((type) => [type, moneyZero()])) as Record<
    BOQCostElementType,
    ReturnType<typeof money>
  >;
}

export const rateAnalysisCalculationService = new RateAnalysisCalculationService();
