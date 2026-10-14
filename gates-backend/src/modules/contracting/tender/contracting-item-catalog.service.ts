import { randomUUID } from 'node:crypto';
import type { BOQItemUnit, ContractingCatalogKind } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

const KINDS: ContractingCatalogKind[] = ['SEASON', 'CHAPTER', 'OFFICIAL', 'EXECUTABLE'];

function parseKind(value: unknown): ContractingCatalogKind {
  if (typeof value === 'string' && KINDS.includes(value as ContractingCatalogKind)) {
    return value as ContractingCatalogKind;
  }
  return 'EXECUTABLE';
}

export class ContractingItemCatalogService {
  async list(companyId: string, kind?: string) {
    return prisma.contractingWorkItemCatalog.findMany({
      where: {
        companyId,
        isActive: true,
        ...(kind && KINDS.includes(kind as ContractingCatalogKind)
          ? { kind: kind as ContractingCatalogKind }
          : {}),
      },
      orderBy: [{ itemCode: 'asc' }],
      take: 1000,
    });
  }

  async create(
    companyId: string,
    input: {
      itemCode: string;
      descriptionAr: string;
      descriptionEn?: string;
      unit?: BOQItemUnit;
      kind?: string;
      groupName?: string;
      notes?: string;
    }
  ) {
    const itemCode = input.itemCode.trim();
    const descriptionAr = input.descriptionAr.trim();
    if (!itemCode) throw new AppError(422, 'كود البند مطلوب');
    if (!descriptionAr) throw new AppError(422, 'بيان البند مطلوب');

    const existing = await prisma.contractingWorkItemCatalog.findFirst({
      where: { companyId, itemCode },
    });
    if (existing) {
      if (existing.isActive) throw new AppError(409, 'كود البند موجود مسبقاً في الدليل');
      return prisma.contractingWorkItemCatalog.update({
        where: { id: existing.id },
        data: {
          descriptionAr,
          descriptionEn: input.descriptionEn?.trim() || null,
          unit: input.unit ?? existing.unit,
          kind: parseKind(input.kind),
          groupName: input.groupName?.trim() || null,
          notes: input.notes?.trim() || null,
          isActive: true,
        },
      });
    }

    return prisma.contractingWorkItemCatalog.create({
      data: {
        id: randomUUID(),
        companyId,
        itemCode,
        descriptionAr,
        descriptionEn: input.descriptionEn?.trim() || null,
        unit: input.unit ?? 'ITEM',
        kind: parseKind(input.kind),
        groupName: input.groupName?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });
  }

  async update(
    companyId: string,
    id: string,
    input: {
      itemCode?: string;
      descriptionAr?: string;
      descriptionEn?: string | null;
      unit?: BOQItemUnit;
      kind?: string;
      groupName?: string | null;
      notes?: string | null;
      isActive?: boolean;
    }
  ) {
    const row = await prisma.contractingWorkItemCatalog.findFirst({ where: { id, companyId } });
    if (!row) throw new AppError(404, 'البند غير موجود في الدليل');

    if (input.itemCode && input.itemCode.trim() !== row.itemCode) {
      const clash = await prisma.contractingWorkItemCatalog.findFirst({
        where: { companyId, itemCode: input.itemCode.trim(), NOT: { id } },
      });
      if (clash) throw new AppError(409, 'كود البند موجود مسبقاً في الدليل');
    }

    return prisma.contractingWorkItemCatalog.update({
      where: { id },
      data: {
        itemCode: input.itemCode?.trim() ?? row.itemCode,
        descriptionAr: input.descriptionAr?.trim() ?? row.descriptionAr,
        descriptionEn: input.descriptionEn !== undefined ? input.descriptionEn : row.descriptionEn,
        unit: input.unit ?? row.unit,
        kind: input.kind !== undefined ? parseKind(input.kind) : row.kind,
        groupName: input.groupName !== undefined ? input.groupName : row.groupName,
        notes: input.notes !== undefined ? input.notes : row.notes,
        isActive: input.isActive ?? row.isActive,
      },
    });
  }

  async deactivate(companyId: string, id: string) {
    const row = await prisma.contractingWorkItemCatalog.findFirst({ where: { id, companyId } });
    if (!row) throw new AppError(404, 'البند غير موجود في الدليل');
    return prisma.contractingWorkItemCatalog.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const contractingItemCatalogService = new ContractingItemCatalogService();
