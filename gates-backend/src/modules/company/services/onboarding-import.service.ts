import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { Decimal } from '@prisma/client/runtime/library';

export class OnboardingImportService {
  async importCustomers(
    companyId: string,
    rows: Array<{ arabicName: string; mobile?: string; code?: string }>
  ) {
    if (!rows.length) throw new AppError(400, 'No rows to import');

    return prisma.$transaction(async (tx) => {
      let created = 0;
      for (const row of rows.slice(0, 500)) {
        if (!row.arabicName?.trim()) continue;
        await tx.customer.create({
          data: {
            companyId,
            arabicName: row.arabicName.trim(),
            mobile: row.mobile?.trim() || null,
            code: row.code?.trim() || null,
            isActive: true,
          },
        });
        created++;
      }
      return { created, total: rows.length };
    });
  }

  async importItems(
    companyId: string,
    rows: Array<{ arabicName: string; serial?: string; salesPrice?: number; unitId?: string }>
  ) {
    if (!rows.length) throw new AppError(400, 'No rows to import');

    const defaultUnit = await prisma.unit.findFirst({
      where: { companyId, isActive: true },
      select: { id: true },
    });
    if (!defaultUnit) {
      throw new AppError(422, 'Define at least one unit before importing items');
    }

    return prisma.$transaction(async (tx) => {
      let created = 0;
      for (const row of rows.slice(0, 500)) {
        if (!row.arabicName?.trim()) continue;
        const item = await tx.item.create({
          data: {
            companyId,
            arabicName: row.arabicName.trim(),
            serial: row.serial?.trim() || null,
            isActive: true,
            beginningCostPrice:
              row.salesPrice != null ? new Decimal(row.salesPrice) : undefined,
          },
        });
        await tx.itemUnit.create({
          data: {
            itemId: item.id,
            unitId: row.unitId ?? defaultUnit.id,
            isBaseUnit: true,
            conversionFactor: new Decimal(1),
          },
        });
        if (row.salesPrice != null && row.salesPrice > 0) {
          const priceList = await tx.priceList.findFirst({
            where: { companyId, isActive: true },
            select: { id: true },
          });
          const unitId = row.unitId ?? defaultUnit.id;
          if (priceList) {
            await tx.itemPrice.create({
              data: {
                itemId: item.id,
                priceListId: priceList.id,
                unitId,
                price: new Decimal(row.salesPrice),
              },
            });
          }
        }
        created++;
      }
      return { created, total: rows.length };
    });
  }
}

export const onboardingImportService = new OnboardingImportService();
