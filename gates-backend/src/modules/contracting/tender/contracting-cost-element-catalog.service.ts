import { randomUUID } from 'node:crypto';
import type { BOQCostElementType } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { money } from '../utils/money-decimal';

const TYPES: BOQCostElementType[] = ['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'SITE_EXPENSE'];

function parseType(value: unknown): BOQCostElementType {
  if (typeof value === 'string' && TYPES.includes(value as BOQCostElementType)) {
    return value as BOQCostElementType;
  }
  throw new AppError(422, 'نوع عنصر التكلفة غير صالح');
}

export class ContractingCostElementCatalogService {
  async list(companyId: string, costElementType?: string) {
    return prisma.contractingCostElementCatalog.findMany({
      where: {
        companyId,
        isActive: true,
        ...(costElementType ? { costElementType: parseType(costElementType) } : {}),
      },
      orderBy: [{ resourceCode: 'asc' }],
      take: 1000,
    });
  }

  async create(
    companyId: string,
    input: {
      costElementType: string;
      resourceCode: string;
      descriptionAr: string;
      unit?: string;
      unitCost?: number;
      notes?: string;
    }
  ) {
    const costElementType = parseType(input.costElementType);
    const resourceCode = input.resourceCode.trim();
    const descriptionAr = input.descriptionAr.trim();
    if (!resourceCode) throw new AppError(422, 'كود المورد مطلوب');
    if (!descriptionAr) throw new AppError(422, 'البيان مطلوب');

    const existing = await prisma.contractingCostElementCatalog.findFirst({
      where: { companyId, costElementType, resourceCode },
    });
    if (existing) {
      if (existing.isActive) throw new AppError(409, 'الكود موجود مسبقاً في هذا الدليل');
      return prisma.contractingCostElementCatalog.update({
        where: { id: existing.id },
        data: {
          descriptionAr,
          unit: input.unit?.trim() || existing.unit,
          unitCost: money(input.unitCost ?? 0),
          notes: input.notes?.trim() || null,
          isActive: true,
        },
      });
    }

    return prisma.contractingCostElementCatalog.create({
      data: {
        id: randomUUID(),
        companyId,
        costElementType,
        resourceCode,
        descriptionAr,
        unit: input.unit?.trim() || 'ITEM',
        unitCost: money(input.unitCost ?? 0),
        notes: input.notes?.trim() || null,
      },
    });
  }

  async update(
    companyId: string,
    id: string,
    input: {
      resourceCode?: string;
      descriptionAr?: string;
      unit?: string;
      unitCost?: number;
      notes?: string | null;
      isActive?: boolean;
    }
  ) {
    const row = await prisma.contractingCostElementCatalog.findFirst({ where: { id, companyId } });
    if (!row) throw new AppError(404, 'العنصر غير موجود في الدليل');
    if (input.resourceCode && input.resourceCode.trim() !== row.resourceCode) {
      const clash = await prisma.contractingCostElementCatalog.findFirst({
        where: {
          companyId,
          costElementType: row.costElementType,
          resourceCode: input.resourceCode.trim(),
          NOT: { id },
        },
      });
      if (clash) throw new AppError(409, 'الكود موجود مسبقاً في هذا الدليل');
    }
    return prisma.contractingCostElementCatalog.update({
      where: { id },
      data: {
        resourceCode: input.resourceCode?.trim() ?? row.resourceCode,
        descriptionAr: input.descriptionAr?.trim() ?? row.descriptionAr,
        unit: input.unit?.trim() ?? row.unit,
        unitCost: input.unitCost != null ? money(input.unitCost) : row.unitCost,
        notes: input.notes !== undefined ? input.notes : row.notes,
        isActive: input.isActive ?? row.isActive,
      },
    });
  }

  async deactivate(companyId: string, id: string) {
    const row = await prisma.contractingCostElementCatalog.findFirst({ where: { id, companyId } });
    if (!row) throw new AppError(404, 'العنصر غير موجود في الدليل');
    return prisma.contractingCostElementCatalog.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const contractingCostElementCatalogService = new ContractingCostElementCatalogService();
