import type { BOQCostElementType } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { rateAnalysisCalculationService } from '../technical-office/services/rate-analysis-calculation.service';
import { money, rate, sumMoney } from '../utils/money-decimal';
import {
  marginPercentFromSelling,
  sellingFromCostPlusMarkup,
  sellingFromTargetMargin,
} from './contract-tender-pricing.util';

export class ContractTenderPricingService {
  async getSummary(companyId: string, tenderId: string) {
    const tender = await prisma.contractTender.findFirst({
      where: { id: tenderId, companyId },
      include: { boqItems: { include: { rateAnalysisItems: true } } },
    });
    if (!tender) throw new AppError(404, 'العطاء غير موجود');

    const byCategory: Record<string, number> = {
      MATERIAL: 0,
      LABOR: 0,
      EQUIPMENT: 0,
      SUBCONTRACTOR: 0,
      SITE_EXPENSE: 0,
    };
    let directCost = 0;
    let sellingValue = 0;
    const lines = [];

    for (const item of tender.boqItems) {
      const qty = Number(item.quantity);
      const directUnit = Number(item.directUnitCost);
      const sellUnit = Number(item.sellingUnitRate);
      const lineDirect = money(qty * directUnit).toNumber();
      const lineSell = money(qty * sellUnit).toNumber();
      directCost = money(directCost + lineDirect).toNumber();
      sellingValue = money(sellingValue + lineSell).toNumber();
      for (const ra of item.rateAnalysisItems) {
        byCategory[ra.costElementType] = money(
          byCategory[ra.costElementType] + Number(ra.totalCostPerUnit) * qty
        ).toNumber();
      }
      lines.push({
        tenderBoqItemId: item.id,
        itemCode: item.itemCode,
        quantity: qty,
        directUnitCost: directUnit,
        sellingUnitRate: sellUnit,
        directTotal: lineDirect,
        sellingTotal: lineSell,
        profit: money(lineSell - lineDirect).toNumber(),
        marginPercent: marginPercentFromSelling(lineDirect, lineSell),
        markupPercent: Number(item.markupRate) * 100,
      });
    }

    const overhead = money(
      directCost * (Number(tender.generalOverheadRate) + Number(tender.siteOverheadRate))
    ).toNumber();
    const risk = money(directCost * Number(tender.contingencyRiskRate)).toNumber();
    const expectedCost = money(directCost + overhead + risk).toNumber();
    const directProfit = money(sellingValue - directCost).toNumber();
    const directMarginPercent = marginPercentFromSelling(directCost, sellingValue);
    const fullyLoadedExpectedProfit = money(sellingValue - expectedCost).toNumber();
    const fullyLoadedExpectedMarginPercent = marginPercentFromSelling(expectedCost, sellingValue);

    return {
      tenderId,
      currencyCode: tender.currencyCode,
      byCategory,
      directCost,
      overhead,
      risk,
      expectedCost,
      sellingValue,
      /** @deprecated use directProfit */
      expectedProfit: directProfit,
      /** @deprecated use directMarginPercent */
      expectedMarginPercent: directMarginPercent,
      directProfit,
      directMarginPercent,
      fullyLoadedExpectedProfit,
      fullyLoadedExpectedMarginPercent,
      policy: {
        contractValueBasis:
          'ClientContract.totalContractValue = quotation subtotal − discount (pre-tax selling scope)',
        marginFormula: '(Selling − Cost) / Selling × 100',
        markupFormula: '(Selling − Cost) / Cost × 100',
      },
      lines,
    };
  }

  async upsertRateAnalysis(
    companyId: string,
    tenderBoqItemId: string,
    items: Array<{
      costElementType: BOQCostElementType;
      descriptionAr: string;
      unit: string;
      consumptionQuotaPerUnit: number;
      unitCost: number;
      wasteFactorRate?: number;
      resourceCode?: string;
      notes?: string;
    }>
  ) {
    const line = await prisma.contractTenderBoqItem.findFirst({
      where: { id: tenderBoqItemId, companyId },
      include: { tender: true },
    });
    if (!line) throw new AppError(404, 'بند العطاء غير موجود');
    if (['AWARDED', 'LOST'].includes(line.tender.status)) throw new AppError(422, 'محمي');

    const computed = rateAnalysisCalculationService.calculateDirectUnitCost(
      tenderBoqItemId,
      items.map((i) => ({
        costElementType: i.costElementType,
        resourceCode: i.resourceCode,
        descriptionAr: i.descriptionAr,
        descriptionEn: null,
        unit: i.unit,
        consumptionQuotaPerUnit: i.consumptionQuotaPerUnit,
        unitCost: i.unitCost,
        wasteFactorRate: i.wasteFactorRate ?? 0,
        notes: i.notes,
      }))
    );

    await prisma.$transaction(async (tx) => {
      await tx.contractTenderRateAnalysisItem.deleteMany({ where: { tenderBoqItemId } });
      await tx.contractTenderRateAnalysisItem.createMany({
        data: items.map((item, index) => ({
          companyId,
          tenderBoqItemId,
          costElementType: item.costElementType,
          resourceCode: item.resourceCode ?? null,
          descriptionAr: item.descriptionAr,
          unit: item.unit,
          consumptionQuotaPerUnit: money(item.consumptionQuotaPerUnit),
          unitCost: money(item.unitCost),
          wasteFactorRate: rate(item.wasteFactorRate ?? 0),
          totalCostPerUnit: computed.elements[index].elementCost,
          notes: item.notes ?? null,
        })),
      });
      await tx.contractTenderBoqItem.update({
        where: { id: tenderBoqItemId },
        data: { directUnitCost: computed.totalDirectCost },
      });
    });

    return this.recalcBoqLine(companyId, tenderBoqItemId);
  }

  async setDirectUnitCost(companyId: string, tenderBoqItemId: string, directUnitCost: number) {
    await prisma.contractTenderBoqItem.updateMany({
      where: { id: tenderBoqItemId, companyId },
      data: { directUnitCost: money(directUnitCost) },
    });
    return this.recalcBoqLine(companyId, tenderBoqItemId);
  }

  async setLinePricing(
    companyId: string,
    tenderBoqItemId: string,
    input: {
      pricingMethod: 'MANUAL_SELLING' | 'COST_PLUS_MARKUP' | 'TARGET_MARGIN';
      markupRate?: number;
      targetMarginRate?: number;
      sellingUnitRate?: number;
    }
  ) {
    const line = await prisma.contractTenderBoqItem.findFirst({ where: { id: tenderBoqItemId, companyId } });
    if (!line) throw new AppError(404, 'البند غير موجود');
    const direct = Number(line.directUnitCost);
    let selling = Number(line.sellingUnitRate);
    let markupRate = input.markupRate ?? Number(line.markupRate);
    let targetMarginRate = input.targetMarginRate ?? Number(line.targetMarginRate ?? 0);

    if (input.pricingMethod === 'MANUAL_SELLING') {
      if (input.sellingUnitRate == null) throw new AppError(422, 'سعر البيع مطلوب');
      selling = input.sellingUnitRate;
    } else if (input.pricingMethod === 'COST_PLUS_MARKUP') {
      selling = sellingFromCostPlusMarkup(direct, markupRate);
    } else {
      if (targetMarginRate >= 1) throw new AppError(422, 'هامش الهدف يجب أن يكون أقل من 100%');
      selling = sellingFromTargetMargin(direct, targetMarginRate);
    }

    return prisma.contractTenderBoqItem.update({
      where: { id: tenderBoqItemId },
      data: {
        pricingMethod: input.pricingMethod,
        markupRate: rate(markupRate),
        targetMarginRate: input.pricingMethod === 'TARGET_MARGIN' ? rate(targetMarginRate) : null,
        sellingUnitRate: money(selling),
      },
    });
  }

  async recalcBoqLine(companyId: string, tenderBoqItemId: string) {
    const line = await prisma.contractTenderBoqItem.findFirst({
      where: { id: tenderBoqItemId, companyId },
      include: { rateAnalysisItems: true, tender: true },
    });
    if (!line) throw new AppError(404, 'البند غير موجود');

    if (line.rateAnalysisItems.length) {
      const computed = rateAnalysisCalculationService.calculateDirectUnitCost(
        tenderBoqItemId,
        line.rateAnalysisItems.map((r) => ({
          costElementType: r.costElementType,
          resourceCode: r.resourceCode,
          descriptionAr: r.descriptionAr,
          descriptionEn: null,
          unit: r.unit,
          consumptionQuotaPerUnit: Number(r.consumptionQuotaPerUnit),
          unitCost: Number(r.unitCost),
          wasteFactorRate: Number(r.wasteFactorRate),
          notes: r.notes,
        }))
      );
      await prisma.contractTenderBoqItem.update({
        where: { id: tenderBoqItemId },
        data: { directUnitCost: computed.totalDirectCost },
      });
      line.directUnitCost = computed.totalDirectCost;
    }

    const direct = Number(line.directUnitCost);
    if (line.pricingMethod === 'COST_PLUS_MARKUP') {
      const selling = sellingFromCostPlusMarkup(direct, Number(line.markupRate));
      return prisma.contractTenderBoqItem.update({
        where: { id: tenderBoqItemId },
        data: { sellingUnitRate: money(selling) },
      });
    }
    return line;
  }

  async applyDefaultMarkup(companyId: string, tenderId: string, markupRate: number) {
    const tender = await prisma.contractTender.findFirst({ where: { id: tenderId, companyId } });
    if (!tender) throw new AppError(404, 'العطاء غير موجود');
    await prisma.contractTender.update({
      where: { id: tenderId },
      data: { defaultMarkupRate: rate(markupRate) },
    });
    const items = await prisma.contractTenderBoqItem.findMany({ where: { tenderId, companyId } });
    for (const item of items) {
      await this.setLinePricing(companyId, item.id, {
        pricingMethod: 'COST_PLUS_MARKUP',
        markupRate,
      });
    }
    return this.getSummary(companyId, tenderId);
  }
}

export const contractTenderPricingService = new ContractTenderPricingService();
