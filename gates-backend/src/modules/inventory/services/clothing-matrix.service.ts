// @ts-nocheck
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type {
  ClothingColorInput,
  ClothingSizeInput,
  ReplaceClothingCombosInput,
} from '../schemas/clothing-matrix.schema';

export class ClothingMatrixService {
  async listColors(companyId: string) {
    return prisma.clothingColor.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ serial: 'asc' }, { arabicName: 'asc' }],
    });
  }

  async upsertColor(companyId: string, id: string | undefined, data: ClothingColorInput) {
    const payload = {
      serial: data.serial || null,
      arabicName: data.arabicName.trim(),
      englishName: data.englishName || null,
      hex: data.hex || null,
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };
    if (id) {
      const existing = await prisma.clothingColor.findFirst({ where: { id, companyId } });
      if (!existing) throw new Error('Color not found');
      return prisma.clothingColor.update({ where: { id }, data: payload });
    }
    return prisma.clothingColor.create({ data: { companyId, ...payload } });
  }

  async removeColor(companyId: string, id: string) {
    const existing = await prisma.clothingColor.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Color not found');
    await prisma.clothingColor.delete({ where: { id } });
    return { success: true };
  }

  async listSizes(companyId: string) {
    return prisma.clothingSize.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { arabicName: 'asc' }],
    });
  }

  async upsertSize(companyId: string, id: string | undefined, data: ClothingSizeInput) {
    const payload = {
      serial: data.serial || null,
      arabicName: data.arabicName.trim(),
      englishName: data.englishName || null,
      sortOrder: data.sortOrder ?? 0,
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };
    if (id) {
      const existing = await prisma.clothingSize.findFirst({ where: { id, companyId } });
      if (!existing) throw new Error('Size not found');
      return prisma.clothingSize.update({ where: { id }, data: payload });
    }
    return prisma.clothingSize.create({ data: { companyId, ...payload } });
  }

  async removeSize(companyId: string, id: string) {
    const existing = await prisma.clothingSize.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Size not found');
    await prisma.clothingSize.delete({ where: { id } });
    return { success: true };
  }

  async listCombos(companyId: string) {
    return prisma.clothingCombo.findMany({
      where: { companyId, isActive: true },
      include: {
        color: { select: { id: true, serial: true, arabicName: true, hex: true } },
        size: { select: { id: true, serial: true, arabicName: true } },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async replaceCombos(companyId: string, data: ReplaceClothingCombosInput) {
    const colorIds = [...new Set(data.combos.map((c) => c.colorId))];
    const sizeIds = [...new Set(data.combos.map((c) => c.sizeId))];
    if (colorIds.length) {
      const colors = await prisma.clothingColor.count({
        where: { companyId, id: { in: colorIds } },
      });
      if (colors !== colorIds.length) throw new Error('Color not found');
    }
    if (sizeIds.length) {
      const sizes = await prisma.clothingSize.count({
        where: { companyId, id: { in: sizeIds } },
      });
      if (sizes !== sizeIds.length) throw new Error('Size not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.clothingCombo.deleteMany({ where: { companyId } });
      if (data.combos.length) {
        await tx.clothingCombo.createMany({
          data: data.combos.map((row) => ({
            companyId,
            colorId: row.colorId,
            sizeId: row.sizeId,
            barcode: row.barcode || null,
          })),
        });
      }
    });

    logger.info({ companyId, count: data.combos.length }, 'Clothing combos replaced');
    return this.listCombos(companyId);
  }
}

export const clothingMatrixService = new ClothingMatrixService();
