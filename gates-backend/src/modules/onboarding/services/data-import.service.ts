import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { Decimal } from '@prisma/client/runtime/library';
import { onboardingImportService } from '../../company/services/onboarding-import.service';
import { inventoryCostingService } from '../../inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../inventory/services/inventory-costing-math';
import { openingImportIdentity, openingImportLookup } from '../../inventory/services/inventory-integrity';

function rowLabel(index: number): string {
  return `صف ${index + 1}`;
}

function requireArabicName(
  rows: Record<string, string | number | null>[],
  errors: string[]
): Array<{ arabicName: string; mobile?: string; code?: string; openingBalance?: number }> {
  const parsed: Array<{ arabicName: string; mobile?: string; code?: string; openingBalance?: number }> = [];
  rows.forEach((r, i) => {
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
      if (rows.length > 500) {
        throw new AppError(422, 'استيراد العملاء حدّه 500 صف في المرة');
      }
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
      if (rows.length > 500) {
        throw new AppError(422, 'استيراد الموردين حدّه 500 صف في المرة');
      }
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

    let resolvedCategoryId = categoryId?.trim() || undefined;
    if (resolvedCategoryId) {
      const category = await prisma.itemCategory.findFirst({
        where: { id: resolvedCategoryId, companyId },
        select: { id: true },
      });
      if (!category) {
        throw new AppError(422, 'مجموعة الأصناف غير موجودة');
      }
    }

    rows.forEach((r, i) => {
      const arabicName = String(r.arabicName ?? r.name ?? '').trim();
      if (!arabicName) {
        errors.push(`${rowLabel(i)}: الإسم العربي مطلوب للصنف`);
      }
    });
    if (errors.length) {
      throw new AppError(422, `Import validation failed: ${errors.slice(0, 15).join(' · ')}`);
    }

    const wh = warehouseId
      ? await prisma.warehouse.findFirst({
          where: { id: warehouseId, companyId },
          select: { id: true, branchId: true, isActive: true },
        })
      : await prisma.warehouse.findFirst({
          where: { companyId, isActive: true },
          select: { id: true, branchId: true, isActive: true },
        });

    if (openingStock && !wh) {
      throw new AppError(422, 'المخزن مطلوب للرصيد الافتتاحي');
    }
    if (openingStock && wh && !wh.isActive) {
      throw new AppError(422, 'المخزن غير نشط');
    }

    const base = await onboardingImportService.importItems(
      companyId,
      rows.map((r) => ({
        arabicName: String(r.arabicName ?? r.name ?? ''),
        serial: String(r.serial ?? r.code ?? '').trim() || undefined,
        barcode: r.barcode != null ? String(r.barcode) : undefined,
        unitName: r.unit != null ? String(r.unit) : r.unitName != null ? String(r.unitName) : undefined,
        salesPrice: r.price != null ? Number(r.price) : r.salesPrice != null ? Number(r.salesPrice) : undefined,
        purchasePrice: r.purchasePrice != null ? Number(r.purchasePrice) : undefined,
        categoryId: resolvedCategoryId,
      }))
    );

    if (openingStock && wh) {
      const year = String(new Date().getFullYear());
      const stockChunk = 100;
      for (let offset = 0; offset < rows.length; offset += stockChunk) {
      await prisma.$transaction(async (tx) => {
        for (const r of rows.slice(offset, offset + stockChunk)) {
          const identity = openingImportIdentity(r);
          const lookup = openingImportLookup(identity);
          if (lookup.kind === 'skip') continue;
          const item =
            lookup.kind === 'codes'
              ? (lookup.serial
                  ? await tx.item.findFirst({
                      where: { companyId, serial: lookup.serial },
                      select: { id: true, serial: true, averageCost: true },
                    })
                  : null) ??
                (lookup.barcode
                  ? await tx.item.findFirst({
                      where: { companyId, barcode: lookup.barcode },
                      select: { id: true, serial: true, averageCost: true },
                    })
                  : null)
              : await tx.item.findFirst({
                  where: { companyId, arabicName: lookup.name },
                  select: { id: true, serial: true, averageCost: true },
                });
          if (!item) continue;
          const unitCost = identity.unitCost > 0 ? identity.unitCost : Number(item.averageCost ?? 0);
          await inventoryCostingService.applyInboundMovement(tx, {
            companyId,
            branchId: wh.branchId ?? undefined,
            warehouseId: wh.id,
            itemId: item.id,
            locationId: null,
            quantity: identity.qty,
            unitCost,
            movementType: COSTING_MOVEMENT.ADJUSTMENT_POSITIVE,
            sourceType: 'IMPORT_OPENING',
            sourceNumber: item.serial || item.id.slice(0, 8),
            sourceYearId: year,
            transactionDate: new Date(),
            updateLastPurchasePrice: identity.unitCost > 0,
          });
        }
      }, { timeout: 30_000 });
      }
    }

    return { entity: 'ITEMS', ...base, openingStockApplied: Boolean(openingStock && wh) };
  }
}

export const dataImportService = new DataImportService();
