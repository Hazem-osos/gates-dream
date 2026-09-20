import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { Decimal } from '@prisma/client/runtime/library';
import { onboardingImportService } from '../../company/services/onboarding-import.service';

function rowLabel(index: number): string {
  return `صف ${index + 1}`;
}

function requireArabicName(
  rows: Record<string, string | number | null>[],
  errors: string[]
): Array<{ arabicName: string; mobile?: string; code?: string; openingBalance?: number }> {
  const parsed: Array<{ arabicName: string; mobile?: string; code?: string; openingBalance?: number }> = [];
  rows.slice(0, 500).forEach((r, i) => {
    const arabicName = String(r.arabicName ?? r.name ?? '').trim();
    if (!arabicName) {
      errors.push(`${rowLabel(i)}: الإسم العربي مطلوب`);
      return;
    }
    const opening = r.openingBalance != null ? Number(r.openingBalance) : Number(r.balance ?? 0);
    parsed.push({
      arabicName,
      mobile: r.mobile != null ? String(r.mobile) : undefined,
      code: r.code != null ? String(r.code) : undefined,
      openingBalance: Number.isFinite(opening) ? opening : 0,
    });
  });
  return parsed;
}

export class DataImportService {
  async importExcel(
    companyId: string,
    payload: {
      entity: 'ITEMS' | 'CUSTOMERS' | 'SUPPLIERS';
      rows: Record<string, string | number | null>[];
      openingStock?: boolean;
      warehouseId?: string;
      categoryId?: string;
    }
  ) {
    const { entity, rows, openingStock, warehouseId, categoryId } = payload;
    const errors: string[] = [];

    if (!rows.length) {
      throw new AppError(400, 'No rows to import');
    }

    if (entity === 'CUSTOMERS') {
      const parsed = requireArabicName(rows, errors);
      if (errors.length) {
        throw new AppError(
          422,
          `Import validation failed: ${errors.slice(0, 15).join(' · ')}`
        );
      }
      const result = await prisma.$transaction(async (tx) => {
        let created = 0;
        for (const row of parsed) {
          await tx.customer.create({
            data: {
              companyId,
              arabicName: row.arabicName,
              mobile: row.mobile?.trim() || null,
              code: row.code?.trim() || null,
              balance: new Decimal(row.openingBalance ?? 0),
              isActive: true,
            },
          });
          created++;
        }
        return { created, total: rows.length };
      });
      return { entity, ...result };
    }

    if (entity === 'SUPPLIERS') {
      const parsed = requireArabicName(rows, errors);
      if (errors.length) {
        throw new AppError(
          422,
          `Import validation failed: ${errors.slice(0, 15).join(' · ')}`
        );
      }
      const result = await prisma.$transaction(async (tx) => {
        let created = 0;
        for (const row of parsed) {
          await tx.supplier.create({
            data: {
              companyId,
              arabicName: row.arabicName,
              mobile: row.mobile?.trim() || null,
              code: row.code?.trim() || null,
              balance: new Decimal(row.openingBalance ?? 0),
              isActive: true,
            },
          });
          created++;
        }
        return { created, total: rows.length };
      });
      return { entity, ...result };
    }

    if (!categoryId) {
      throw new AppError(422, 'اختَر مجموعة الأصناف قبل الاستيراد');
    }
    const category = await prisma.itemCategory.findFirst({
      where: { id: categoryId, companyId },
      select: { id: true },
    });
    if (!category) {
      throw new AppError(422, 'مجموعة الأصناف غير موجودة');
    }

    rows.slice(0, 500).forEach((r, i) => {
      const arabicName = String(r.arabicName ?? r.name ?? '').trim();
      if (!arabicName) {
        errors.push(`${rowLabel(i)}: الإسم العربي مطلوب للصنف`);
      }
    });
    if (errors.length) {
      throw new AppError(422, `Import validation failed: ${errors.join('; ')}`);
    }

    const wh =
      warehouseId ??
      (
        await prisma.warehouse.findFirst({
          where: { companyId, isActive: true },
          select: { id: true },
        })
      )?.id;

    if (openingStock && !wh) {
      throw new AppError(422, 'Warehouse required for opening stock');
    }

    const base = await onboardingImportService.importItems(
      companyId,
      rows.map((r) => ({
        arabicName: String(r.arabicName ?? r.name ?? ''),
        serial: r.serial != null ? String(r.serial) : r.barcode != null ? String(r.barcode) : undefined,
        barcode: r.barcode != null ? String(r.barcode) : undefined,
        unitName: r.unit != null ? String(r.unit) : r.unitName != null ? String(r.unitName) : undefined,
        salesPrice: r.price != null ? Number(r.price) : r.salesPrice != null ? Number(r.salesPrice) : undefined,
        purchasePrice: r.purchasePrice != null ? Number(r.purchasePrice) : undefined,
        categoryId,
      }))
    );

    if (openingStock && wh) {
      await prisma.$transaction(async (tx) => {
        for (const r of rows.slice(0, 500)) {
          const serial = r.barcode != null ? String(r.barcode) : r.serial != null ? String(r.serial) : null;
          const name = String(r.arabicName ?? r.name ?? '').trim();
          const qty = Number(r.quantity ?? r.qty ?? r.openingQty ?? 0);
          if (!name || !Number.isFinite(qty) || qty <= 0) continue;
          const item = await tx.item.findFirst({
            where: {
              companyId,
              OR: [...(serial ? [{ serial }] : []), { arabicName: name }],
            },
            select: { id: true },
          });
          if (!item) continue;
          const existing = await tx.itemQuantity.findFirst({
            where: {
              itemId: item.id,
              warehouseId: wh,
              item: { companyId },
              warehouse: { companyId },
            },
          });
          if (existing) {
            await tx.itemQuantity.update({
              where: { id: existing.id },
              data: { quantity: new Decimal(Number(existing.quantity) + qty) },
            });
          } else {
            await tx.itemQuantity.create({
              data: {
                itemId: item.id,
                warehouseId: wh,
                quantity: new Decimal(qty),
              },
            });
          }
        }
      });
    }

    return { entity: 'ITEMS', ...base, openingStockApplied: Boolean(openingStock && wh) };
  }
}

export const dataImportService = new DataImportService();
