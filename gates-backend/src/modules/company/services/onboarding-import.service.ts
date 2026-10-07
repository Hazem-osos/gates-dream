import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { Decimal } from '@prisma/client/runtime/library';
import {
  indexExistingItems,
  matchImportedItem,
  rememberImportedItemKeys,
} from '../../inventory/utils/item-import-match';
import { ensureDefaultUngroupedCategory } from '../../inventory/services/ensure-default-item-category';
import { resolveItemBarcode } from '../../inventory/utils/item-barcode-default';
import { nextNumericCode } from '../../../shared/utils/next-numeric-code';
import { acquireUniqueKey, UNIQUE_KINDS } from '../../../shared/database/company-unique-key';

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
    if (rows.length > 500) throw new AppError(422, 'استيراد العملاء حدّه 500 صف في المرة');

    return prisma.$transaction(async (tx) => {
      let created = 0;
      for (const row of rows) {
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

    const existing = await prisma.item.findMany({
      where: { companyId },
      select: { id: true, arabicName: true, englishName: true, barcode: true, serial: true },
    });
    const catalog = indexExistingItems(existing);
    const seen = { barcodes: new Set<string>(), serials: new Set<string>(), names: new Set<string>() };
    const unitCache = new Map<string, string>();
    let serialPool = existing.map((item) => item.serial);
    const fallbackCategory = await prisma.$transaction((tx) =>
      ensureDefaultUngroupedCategory(companyId, tx)
    );
    const priceList = await prisma.priceList.findFirst({
      where: { companyId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    let created = 0;
    let skippedExisting = 0;
    let skippedInSheet = 0;
    const chunkSize = 100;

    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const chunk = rows.slice(offset, offset + chunkSize);
      const committed = await prisma.$transaction(
        async (tx) => {
          const localSeen = {
            barcodes: new Set(seen.barcodes),
            serials: new Set(seen.serials),
            names: new Set(seen.names),
          };
          const localPool = [...serialPool];
          let chunkCreated = 0;
          let chunkSkippedExisting = 0;
          let chunkSkippedInSheet = 0;
          for (const row of chunk) {
            if (!row.arabicName?.trim()) continue;
            const barcode = row.barcode?.trim() || null;
            const explicitSerial = row.serial?.trim() || null;
            const incoming = { arabicName: row.arabicName.trim(), barcode, serial: explicitSerial };
            const match = matchImportedItem(
              incoming,
              catalog.existingByBarcode,
              catalog.existingBySerial,
              catalog.existingByName,
              localSeen
            );
            rememberImportedItemKeys(incoming, localSeen);
            if (match) {
              if (match.kind.startsWith('sheet-')) chunkSkippedInSheet += 1;
              else chunkSkippedExisting += 1;
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
            const serial = explicitSerial || nextNumericCode(localPool);
            localPool.push(serial);
            const resolvedBarcode = resolveItemBarcode(barcode, serial);
            await acquireUniqueKey(tx, companyId, UNIQUE_KINDS.itemName, incoming.arabicName);
            const item = await tx.item.create({
              data: {
                companyId,
                arabicName: row.arabicName.trim(),
                serial,
                barcode: resolvedBarcode,
                categoryId: row.categoryId || fallbackCategory.id,
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
            if (salesPrice != null && salesPrice > 0 && priceList) {
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
            chunkCreated++;
          }
          return {
            chunkCreated,
            chunkSkippedExisting,
            chunkSkippedInSheet,
            localSeen,
            localPool,
          };
        },
        { timeout: 30_000 }
      );
      created += committed.chunkCreated;
      skippedExisting += committed.chunkSkippedExisting;
      skippedInSheet += committed.chunkSkippedInSheet;
      seen.barcodes = committed.localSeen.barcodes;
      seen.serials = committed.localSeen.serials;
      seen.names = committed.localSeen.names;
      serialPool = committed.localPool;
    }

    return {
      created,
      skipped: skippedExisting + skippedInSheet,
      skippedExisting,
      skippedInSheet,
      total: rows.length,
    };
  }
}

export const onboardingImportService = new OnboardingImportService();
