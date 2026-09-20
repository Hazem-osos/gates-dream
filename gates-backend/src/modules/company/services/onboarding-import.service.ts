import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { Decimal } from '@prisma/client/runtime/library';
import {
  indexExistingItems,
  matchImportedItem,
  rememberImportedItemKeys,
} from '../../inventory/utils/item-import-match';

type ImportUnitHint = {
  code: string;
  arabicName: string;
  englishName: string;
};

const UNIT_HINTS: ImportUnitHint[] = [
  { code: 'PCS', arabicName: 'قطعة', englishName: 'Piece' },
  { code: 'DOZ', arabicName: 'دستة', englishName: 'Dozen' },
  { code: 'PAIR', arabicName: 'زوج', englishName: 'Pair' },
  { code: 'SET', arabicName: 'طقم', englishName: 'Set' },
  { code: 'BOX', arabicName: 'صندوق', englishName: 'Box' },
  { code: 'CTN', arabicName: 'كرتونة', englishName: 'Carton' },
  { code: 'PACK', arabicName: 'باكت', englishName: 'Pack' },
  { code: 'BAG', arabicName: 'كيس', englishName: 'Bag' },
  { code: 'ROLL', arabicName: 'رول', englishName: 'Roll' },
  { code: 'KG', arabicName: 'كيلوجرام', englishName: 'Kilogram' },
  { code: 'G', arabicName: 'جرام', englishName: 'Gram' },
  { code: 'TON', arabicName: 'طن', englishName: 'Ton' },
  { code: 'L', arabicName: 'لتر', englishName: 'Liter' },
  { code: 'ML', arabicName: 'ملليلتر', englishName: 'Milliliter' },
  { code: 'M', arabicName: 'متر', englishName: 'Meter' },
  { code: 'CM', arabicName: 'سنتيمتر', englishName: 'Centimeter' },
];

const UNIT_ALIASES: Record<string, string> = {
  قطعه: 'PCS',
  قطعة: 'PCS',
  حبة: 'PCS',
  حبه: 'PCS',
  pcs: 'PCS',
  piece: 'PCS',
  كيلو: 'KG',
  كيلوا: 'KG',
  كيلوجرام: 'KG',
  kg: 'KG',
  kilo: 'KG',
  kilogram: 'KG',
  جرام: 'G',
  غرام: 'G',
  g: 'G',
  gram: 'G',
  لتر: 'L',
  liter: 'L',
  litre: 'L',
  متر: 'M',
  meter: 'M',
};

function normalizeUnitKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-]/g, '');
}

function hintForUnitName(unitName: string): ImportUnitHint | undefined {
  const key = normalizeUnitKey(unitName);
  const code = UNIT_ALIASES[key] ?? UNIT_HINTS.find((item) => normalizeUnitKey(item.code) === key || normalizeUnitKey(item.arabicName) === key || normalizeUnitKey(item.englishName) === key)?.code;
  return UNIT_HINTS.find((item) => item.code === code);
}

async function resolveImportUnitId(
  tx: {
    unit: {
      findFirst: typeof prisma.unit.findFirst;
      findMany: typeof prisma.unit.findMany;
      create: typeof prisma.unit.create;
    };
  },
  companyId: string,
  unitName: string | undefined
): Promise<string> {
  const raw = unitName?.trim() || 'قطعة';
  const hint = hintForUnitName(raw);
  const units = await tx.unit.findMany({
    where: { companyId },
    select: { id: true, arabicName: true, englishName: true, code: true },
  });
  const key = normalizeUnitKey(raw);
  const match = units.find((unit) => {
    const names = [unit.arabicName, unit.englishName ?? '', unit.code ?? ''].map(normalizeUnitKey);
    if (names.includes(key)) return true;
    if (hint && (unit.code === hint.code || normalizeUnitKey(unit.arabicName) === normalizeUnitKey(hint.arabicName))) {
      return true;
    }
    return false;
  });
  if (match) return match.id;

  const created = await tx.unit.create({
    data: {
      companyId,
      arabicName: hint?.arabicName ?? raw,
      englishName: hint?.englishName ?? null,
      code: hint?.code ?? null,
      isActive: true,
    },
  });
  return created.id;
}

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
    rows: Array<{
      arabicName: string;
      serial?: string;
      barcode?: string;
      salesPrice?: number;
      purchasePrice?: number;
      unitName?: string;
      unitId?: string;
      categoryId?: string;
    }>
  ) {
    if (!rows.length) throw new AppError(400, 'No rows to import');

    return prisma.$transaction(async (tx) => {
      const existing = await tx.item.findMany({
        where: { companyId },
        select: { id: true, arabicName: true, englishName: true, barcode: true, serial: true },
      });
      const catalog = indexExistingItems(existing);
      const seen = { barcodes: new Set<string>(), serials: new Set<string>(), names: new Set<string>() };
      const unitCache = new Map<string, string>();
      let created = 0;
      let skippedExisting = 0;
      let skippedInSheet = 0;
      for (const row of rows.slice(0, 500)) {
        if (!row.arabicName?.trim()) continue;
        const barcode = row.barcode?.trim() || row.serial?.trim() || null;
        const serial = row.serial?.trim() || barcode;
        const incoming = { arabicName: row.arabicName.trim(), barcode, serial };
        const match = matchImportedItem(
          incoming,
          catalog.existingByBarcode,
          catalog.existingBySerial,
          catalog.existingByName,
          seen
        );
        rememberImportedItemKeys(incoming, seen);
        if (match) {
          if (match.kind.startsWith('sheet-')) skippedInSheet += 1;
          else skippedExisting += 1;
          continue;
        }
        const unitKey = (row.unitId || row.unitName || 'قطعة').trim();
        let unitId = row.unitId || unitCache.get(unitKey);
        if (!unitId) {
          unitId = await resolveImportUnitId(tx, companyId, row.unitName);
          unitCache.set(unitKey, unitId);
        }
        const salesPrice =
          row.salesPrice != null && Number.isFinite(row.salesPrice) ? row.salesPrice : null;
        const purchasePrice =
          row.purchasePrice != null && Number.isFinite(row.purchasePrice) ? row.purchasePrice : null;
        const item = await tx.item.create({
          data: {
            companyId,
            arabicName: row.arabicName.trim(),
            serial: row.serial?.trim() || barcode,
            barcode,
            categoryId: row.categoryId || null,
            isActive: true,
            beginningCostPrice: purchasePrice != null ? new Decimal(purchasePrice) : undefined,
            lastPurchasePrice: purchasePrice != null ? new Decimal(purchasePrice) : undefined,
            priceRetail: salesPrice != null ? new Decimal(salesPrice) : undefined,
            retailPrice: salesPrice != null ? new Decimal(salesPrice) : undefined,
            consumerPrice: salesPrice != null ? new Decimal(salesPrice) : undefined,
          },
        });
        await tx.itemUnit.create({
          data: {
            itemId: item.id,
            unitId,
            isBaseUnit: true,
            conversionFactor: new Decimal(1),
          },
        });
        if (salesPrice != null && salesPrice > 0) {
          const priceList = await tx.priceList.findFirst({
            where: { companyId, isActive: true },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          });
          if (priceList) {
            await tx.itemPrice.create({
              data: {
                itemId: item.id,
                priceListId: priceList.id,
                unitId,
                price: new Decimal(salesPrice),
                retailPrice: new Decimal(salesPrice),
              },
            });
          }
        }
        created++;
      }
      return {
        created,
        skipped: skippedExisting + skippedInSheet,
        skippedExisting,
        skippedInSheet,
        total: rows.length,
      };
    });
  }
}

export const onboardingImportService = new OnboardingImportService();
