import type { BOQCostElementType, Prisma } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { money, rate, sumMoney } from '../../utils/money-decimal';
import {
  assertAcyclicParent,
  leafItems,
  orphanChildIdsForParentCode,
  parentCodeFromItemCode,
} from '../../utils/boq-hierarchy.util';
import { AppError } from '../../../../shared/middleware/error-handler';
import {
  ContractingProjectNotFoundError,
  MeasurementSheetNotFoundError,
  MeasurementSheetStateError,
  ProjectBOQItemNotFoundError,
} from '../errors/technical-office-domain.errors';
import type { CreateMeasurementSheetDto } from '../types/measurement-sheet.types';
import type { SetMarkupDto, UpsertRateAnalysisDto } from '../types/rate-analysis.types';
import { executiveMeasurementSheetService } from './executive-measurement-sheet.service';
import { rateAnalysisCalculationService } from './rate-analysis-calculation.service';
import { isOwnerBoqItemCertifiableInTx } from '../../variation/contract-variation-effective.service';
import { OwnerBoqItemNotCertifiableError } from '../../variation/variation-domain.errors';

const ELEMENT_LABEL_AR: Record<BOQCostElementType, string> = {
  MATERIAL: 'خامات',
  LABOR: 'عمالة',
  EQUIPMENT: 'معدات',
  SUBCONTRACTOR: 'مقاول باطن',
  SITE_EXPENSE: 'مصاريف موقع',
};

const APPROVABLE_SHEET_STATUSES = ['DRAFT', 'SITE_ENGINEER_VERIFIED'] as const;

export class TechnicalOfficeCommandService {
  async createOwnerBoqItem(
    companyId: string,
    projectId: string,
    dto: {
      itemCode: string;
      descriptionAr: string;
      descriptionEn?: string | null;
      unit: 'M2' | 'M3' | 'TON' | 'ITEM' | 'LM' | 'LS';
      contractQuantity: string | number;
      parentId?: string | null;
      notes?: string | null;
      isExecutable?: boolean;
    }
  ) {
    await this.assertProject(companyId, projectId);
    return prisma.$transaction(async (tx) => {
      const siblings = await tx.projectBOQItem.findMany({
        where: { companyId, projectId },
        select: { id: true, parentId: true, itemCode: true },
      });
      let parentId = dto.parentId?.trim() || null;
      if (!parentId) {
        const inferred = parentCodeFromItemCode(dto.itemCode);
        if (inferred) {
          parentId = siblings.find((row) => row.itemCode === inferred)?.id ?? null;
        }
      }
      if (parentId) {
        const parent = siblings.find((row) => row.id === parentId);
        if (!parent) throw new AppError(404, 'Parent BOQ item not found on this project');
        try {
          assertAcyclicParent([...siblings, { id: 'new', parentId: null }], 'new', parentId);
        } catch {
          throw new AppError(400, 'BOQ parent would create a cycle');
        }
        await tx.projectBOQItem.update({
          where: { id: parentId },
          data: { isExecutable: false },
        });
      }
      const created = await tx.projectBOQItem.create({
        data: {
          companyId,
          projectId,
          parentId,
          isExecutable: dto.isExecutable ?? true,
          itemCode: dto.itemCode.trim(),
          descriptionAr: dto.descriptionAr,
          descriptionEn: dto.descriptionEn ?? null,
          unit: dto.unit,
          contractQuantity: money(dto.contractQuantity),
          notes: dto.notes ?? null,
          status: 'PENDING_PRICING',
        },
      });
      const orphanIds = orphanChildIdsForParentCode(
        siblings.map((row) => ({ id: row.id, itemCode: row.itemCode, parentId: row.parentId })),
        created.itemCode,
        created.id
      );
      if (orphanIds.length) {
        await tx.projectBOQItem.updateMany({
          where: { id: { in: orphanIds }, companyId, projectId },
          data: { parentId: created.id },
        });
        return tx.projectBOQItem.update({
          where: { id: created.id },
          data: { isExecutable: false },
        });
      }
      return created;
    });
  }

  async listProjectBoq(companyId: string, projectId: string) {
    await this.assertProject(companyId, projectId);

    const items = await prisma.projectBOQItem.findMany({
      where: { companyId, projectId },
      include: {
        rateAnalysisItems: { orderBy: { createdAt: 'asc' } },
        markupStructures: { orderBy: { updatedAt: 'desc' }, take: 1 },
        _count: { select: { children: true } },
      },
      orderBy: { itemCode: 'asc' },
    });

    const hierarchy = items.map((item) => ({
      id: item.id,
      parentId: item.parentId,
      quantity: Number(item.contractQuantity),
      unitPrice: Number(item.unitSellingPrice),
    }));
    const leafIds = new Set(leafItems(hierarchy).map((row) => row.id));
    const leafContractValue = sumMoney(
      items
        .filter((item) => leafIds.has(item.id))
        .map((item) => money(item.contractQuantity).mul(money(item.unitSellingPrice)))
    );

    return items.map((item) => {
      const contractQuantity = money(item.contractQuantity);
      const executedQty = money(item.cumulativeExecutedQty);
      const directCostEstimated = money(item.directCostEstimated);
      const completionRate = contractQuantity.gt(0)
        ? rate(executedQty.div(contractQuantity))
        : rate(0);
      const isLeaf = leafIds.has(item.id);

      return {
        ...item,
        hasChildren: item._count.children > 0,
        isLeaf,
        costStatus: {
          pricingStatus: item.status,
          hasRateAnalysis: item.rateAnalysisItems.length > 0,
          elementCount: item.rateAnalysisItems.length,
          plannedBudgetCost: money(contractQuantity.mul(directCostEstimated)),
          earnedBudgetCost: money(executedQty.mul(directCostEstimated)),
          quantityVariance: money(executedQty.minus(contractQuantity)),
          completionRate,
          leafOnlyContractSellingTotal: leafContractValue,
        },
      };
    });
  }

  async upsertRateAnalysis(companyId: string, boqItemId: string, dto: UpsertRateAnalysisDto) {
    return prisma.$transaction(async (tx) => {
      const boq = await this.requireBoq(tx, companyId, boqItemId);
      const child = await tx.projectBOQItem.findFirst({
        where: { companyId, parentId: boq.id },
        select: { id: true },
      });
      if (child || boq.isExecutable === false) {
        throw new AppError(
          422,
          `Cannot attach cost analysis to header BOQ item ${boq.itemCode}; analyze leaf items only`
        );
      }
      const computed = rateAnalysisCalculationService.calculateDirectUnitCost(boq.id, dto.items);

      await tx.bOQRateAnalysisItem.deleteMany({
        where: { companyId, projectBOQItemId: boq.id },
      });

      await tx.bOQRateAnalysisItem.createMany({
        data: dto.items.map((item, index) => ({
          companyId,
          projectBOQItemId: boq.id,
          costElementType: item.costElementType,
          resourceCode: item.resourceCode ?? null,
          descriptionAr: item.descriptionAr?.trim() || ELEMENT_LABEL_AR[item.costElementType],
          descriptionEn: item.descriptionEn ?? null,
          unit: item.unit,
          consumptionQuotaPerUnit: money(item.consumptionQuotaPerUnit),
          unitCost: money(item.unitCost),
          wasteFactorRate: rate(item.wasteFactorRate ?? 0),
          totalCostPerUnit: computed.elements[index].elementCost,
          notes: item.notes ?? null,
        })),
      });

      const priced = await rateAnalysisCalculationService.computeBoqItemSellingPriceInTx(
        tx,
        companyId,
        boq.id
      );

      const refreshed = await tx.projectBOQItem.findFirstOrThrow({
        where: { id: boq.id, companyId },
        include: { rateAnalysisItems: true, markupStructures: true },
      });

      return { item: refreshed, pricing: priced };
    });
  }

  async setMarkupAndComputeSellingPrice(companyId: string, boqItemId: string, dto: SetMarkupDto) {
    return prisma.$transaction(async (tx) => {
      const boq = await this.requireBoq(tx, companyId, boqItemId);
      const rates = {
        generalOverheadRate: rate(dto.generalOverheadRate),
        siteOverheadRate: rate(dto.siteOverheadRate),
        contingencyRiskRate: rate(dto.contingencyRiskRate),
        profitMarginRate: rate(dto.profitMarginRate),
        contractTaxesRate: rate(dto.contractTaxesRate),
      };

      if (dto.applyAtProjectLevel) {
        const existing = await tx.bOQMarkupStructure.findFirst({
          where: { companyId, projectId: boq.projectId, projectBOQItemId: null },
          orderBy: { updatedAt: 'desc' },
        });
        if (existing) {
          await tx.bOQMarkupStructure.update({ where: { id: existing.id }, data: rates });
        } else {
          await tx.bOQMarkupStructure.create({
            data: { companyId, projectId: boq.projectId, projectBOQItemId: null, ...rates },
          });
        }
      } else {
        const existing = await tx.bOQMarkupStructure.findFirst({
          where: { companyId, projectBOQItemId: boq.id },
          orderBy: { updatedAt: 'desc' },
        });
        if (existing) {
          await tx.bOQMarkupStructure.update({ where: { id: existing.id }, data: rates });
        } else {
          await tx.bOQMarkupStructure.create({
            data: { companyId, projectBOQItemId: boq.id, projectId: boq.projectId, ...rates },
          });
        }
      }

      const targets = dto.applyAtProjectLevel
        ? await tx.projectBOQItem.findMany({
            where: { companyId, projectId: boq.projectId, rateAnalysisItems: { some: {} } },
            select: { id: true },
          })
        : [{ id: boq.id }];

      const pricing = [];
      for (const target of targets) {
        pricing.push(
          await rateAnalysisCalculationService.computeBoqItemSellingPriceInTx(
            tx,
            companyId,
            target.id
          )
        );
      }

      const item = await tx.projectBOQItem.findFirstOrThrow({
        where: { id: boq.id, companyId },
        include: { rateAnalysisItems: true, markupStructures: true },
      });

      return { item, pricing: pricing.find((row) => row.boqItemId === boq.id) ?? pricing[0], allPriced: pricing };
    });
  }

  async listMeasurementSheets(companyId: string, boqItemId: string) {
    await this.requireBoq(prisma, companyId, boqItemId);
    return prisma.executiveMeasurementSheet.findMany({
      where: { companyId, projectBOQItemId: boqItemId },
      orderBy: [{ measurementDate: 'desc' }, { sheetNumber: 'desc' }],
    });
  }

  async createMeasurementSheet(companyId: string, dto: CreateMeasurementSheetDto) {
    const boq = await this.requireBoq(prisma, companyId, dto.projectBOQItemId);
    const certifiable = await isOwnerBoqItemCertifiableInTx(prisma, companyId, boq.id);
    if (!certifiable) {
      throw new OwnerBoqItemNotCertifiableError(boq.id, boq.itemCode);
    }
    const qty = executiveMeasurementSheetService.calculateSheetNetQuantity(dto);

    return prisma.executiveMeasurementSheet.create({
      data: {
        companyId,
        projectId: boq.projectId,
        projectBOQItemId: boq.id,
        sheetNumber: dto.sheetNumber,
        measurementDate: dto.measurementDate,
        locationZone: dto.locationZone ?? null,
        axisGridRef: dto.axisGridRef ?? null,
        statement: dto.statement ?? null,
        multiplierCount: qty.multiplierCount,
        dimensionLength: qty.dimensionLength,
        dimensionWidth: qty.dimensionWidth,
        dimensionHeight: qty.dimensionHeight,
        calculatedGrossQty: qty.calculatedGrossQty,
        deductionQty: qty.deductionQty,
        netExecutedQty: qty.netExecutedQty,
        attachments: dto.attachments ?? undefined,
        status: 'DRAFT',
      },
    });
  }

  async approveMeasurementSheet(companyId: string, sheetId: string) {
    return prisma.$transaction(async (tx) => {
      const sheet = await tx.executiveMeasurementSheet.findFirst({
        where: { id: sheetId, companyId },
      });
      if (!sheet) throw new MeasurementSheetNotFoundError(companyId, sheetId);
      if (sheet.status === 'CONSULTANT_APPROVED') return sheet;
      if (sheet.status === 'INVOICED_IN_EXTRACT') {
        throw new MeasurementSheetStateError(sheet.id, sheet.status, [...APPROVABLE_SHEET_STATUSES]);
      }
      if (!(APPROVABLE_SHEET_STATUSES as readonly string[]).includes(sheet.status)) {
        throw new MeasurementSheetStateError(sheet.id, sheet.status, [...APPROVABLE_SHEET_STATUSES]);
      }

      return tx.executiveMeasurementSheet.update({
        where: { id: sheet.id },
        data: { status: 'CONSULTANT_APPROVED' },
      });
    });
  }

  private async requireBoq(
    db: Prisma.TransactionClient | typeof prisma,
    companyId: string,
    boqItemId: string
  ) {
    const boq = await db.projectBOQItem.findFirst({
      where: { id: boqItemId, companyId },
    });
    if (!boq) throw new ProjectBOQItemNotFoundError(companyId, boqItemId);
    return boq;
  }

  private async assertProject(companyId: string, projectId: string) {
    const project = await prisma.contractingProject.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);
  }
}

export const technicalOfficeCommandService = new TechnicalOfficeCommandService();
