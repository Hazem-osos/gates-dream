import type { DocumentBaseType, Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import type {
  CreateDocumentProfileInput,
  UpdateDocumentProfileInput,
} from '../schemas/document-profile.schema';

const PROFILE_INCLUDE = {
  defaultWarehouse: { select: { id: true, code: true, arabicName: true } },
  defaultTreasury: { select: { id: true, code: true, arabicName: true } },
  defaultCostCenter: { select: { id: true, code: true, arabicName: true } },
} as const;

export class DocumentProfileService {
  async list(
    companyId: string,
    opts?: { baseType?: DocumentBaseType; sidebarOnly?: boolean; includeInactive?: boolean }
  ) {
    const where: Prisma.DocumentProfileWhereInput = { companyId };
    if (opts?.baseType) where.baseType = opts.baseType;
    if (opts?.sidebarOnly) {
      where.showInSidebar = true;
      where.isActive = true;
    } else if (!opts?.includeInactive) {
      where.isActive = true;
    }
    return prisma.documentProfile.findMany({
      where,
      include: PROFILE_INCLUDE,
      orderBy: [{ baseType: 'asc' }, { nameAr: 'asc' }],
    });
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.documentProfile.findFirst({
      where: { id, companyId },
      include: PROFILE_INCLUDE,
    });
    if (!row) throw new AppError(404, 'نمط المستند غير موجود');
    return row;
  }

  async getBySlug(companyId: string, slug: string) {
    const row = await prisma.documentProfile.findFirst({
      where: { companyId, slug },
      include: PROFILE_INCLUDE,
    });
    if (!row) throw new AppError(404, 'نمط المستند غير موجود');
    return row;
  }

  async create(companyId: string, input: CreateDocumentProfileInput) {
    const slug = input.slug.trim().toLowerCase();
    const clash = await prisma.documentProfile.findFirst({
      where: { companyId, slug },
      select: { id: true },
    });
    if (clash) throw new AppError(409, 'رمز النمط مستخدم بالفعل في هذا النشاط');

    return prisma.documentProfile.create({
      data: {
        companyId,
        slug,
        nameAr: input.nameAr,
        nameEn: input.nameEn ?? null,
        baseType: input.baseType,
        prefix: input.prefix?.trim() || null,
        nextNumber: input.nextNumber ?? 1,
        defaultWarehouseId: input.defaultWarehouseId ?? null,
        lockWarehouse: input.lockWarehouse ?? false,
        defaultTreasuryId: input.defaultTreasuryId ?? null,
        lockTreasury: input.lockTreasury ?? false,
        defaultCostCenterId: input.defaultCostCenterId ?? null,
        lockCostCenter: input.lockCostCenter ?? false,
        visibleColumns: input.visibleColumns ?? [],
        showInSidebar: input.showInSidebar ?? false,
        isActive: input.isActive ?? true,
      },
      include: PROFILE_INCLUDE,
    });
  }

  async update(companyId: string, id: string, input: UpdateDocumentProfileInput) {
    await this.getById(companyId, id);
    if (input.slug) {
      const slug = input.slug.trim().toLowerCase();
      const clash = await prisma.documentProfile.findFirst({
        where: { companyId, slug, NOT: { id } },
        select: { id: true },
      });
      if (clash) throw new AppError(409, 'رمز النمط مستخدم بالفعل في هذا النشاط');
    }

    return prisma.documentProfile.update({
      where: { id },
      data: {
        ...(input.slug ? { slug: input.slug.trim().toLowerCase() } : {}),
        ...(input.nameAr !== undefined ? { nameAr: input.nameAr } : {}),
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
        ...(input.baseType !== undefined ? { baseType: input.baseType } : {}),
        ...(input.prefix !== undefined ? { prefix: input.prefix?.trim() || null } : {}),
        ...(input.nextNumber !== undefined ? { nextNumber: input.nextNumber } : {}),
        ...(input.defaultWarehouseId !== undefined
          ? { defaultWarehouseId: input.defaultWarehouseId }
          : {}),
        ...(input.lockWarehouse !== undefined ? { lockWarehouse: input.lockWarehouse } : {}),
        ...(input.defaultTreasuryId !== undefined
          ? { defaultTreasuryId: input.defaultTreasuryId }
          : {}),
        ...(input.lockTreasury !== undefined ? { lockTreasury: input.lockTreasury } : {}),
        ...(input.defaultCostCenterId !== undefined
          ? { defaultCostCenterId: input.defaultCostCenterId }
          : {}),
        ...(input.lockCostCenter !== undefined ? { lockCostCenter: input.lockCostCenter } : {}),
        ...(input.visibleColumns !== undefined ? { visibleColumns: input.visibleColumns } : {}),
        ...(input.showInSidebar !== undefined ? { showInSidebar: input.showInSidebar } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: PROFILE_INCLUDE,
    });
  }

  async deactivate(companyId: string, id: string) {
    await this.getById(companyId, id);
    return prisma.documentProfile.update({
      where: { id },
      data: { isActive: false, showInSidebar: false },
      include: PROFILE_INCLUDE,
    });
  }
}

export const documentProfileService = new DocumentProfileService();
