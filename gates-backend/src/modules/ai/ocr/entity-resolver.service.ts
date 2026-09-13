import prisma from '../../../shared/database/prisma';
import { prismaWriteCatalog } from '../actions/write-catalog';
import type {
  OcrInvoiceExtraction,
  ResolvedOcrInvoice,
  ResolvedOcrLine,
  ResolvedOcrSupplier,
} from './invoice-ocr.types';

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function levenshtein(left: string, right: string): number {
  const a = normalize(left);
  const b = normalize(right);
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function similarity(left: string, right: string): number {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 82;
  const max = Math.max(a.length, b.length);
  const distance = levenshtein(a, b);
  const base = Math.max(0, Math.round((1 - distance / max) * 100));
  const tokenHits = tokens(b).filter((token) => a.includes(token)).length;
  const tokenBoost = tokens(b).length ? (tokenHits / tokens(b).length) * 20 : 0;
  return Math.min(100, Math.round(base * 0.75 + tokenBoost));
}

export class EntityResolverService {
  async resolve(companyId: string, extraction: OcrInvoiceExtraction): Promise<ResolvedOcrInvoice> {
    const [supplier, warehouse, lines] = await Promise.all([
      this.resolveSupplier(companyId, extraction.supplierName, extraction.supplierTaxNumber),
      this.defaultWarehouse(companyId),
      Promise.all(extraction.lines.map((line) => this.resolveLine(companyId, line))),
    ]);
    return { extraction, supplier, warehouse: warehouse ?? undefined, lines };
  }

  async resolveSupplier(
    companyId: string,
    name: string,
    taxNumber?: string
  ): Promise<ResolvedOcrSupplier> {
    const tax = taxNumber?.replace(/\s+/g, '').trim();
    if (tax) {
      const byTax = await prisma.supplier.findFirst({
        where: {
          companyId,
          isActive: true,
          OR: [{ taxAuthority: tax }, { registrationNumber: tax }],
        },
        select: { id: true, arabicName: true, taxAuthority: true, registrationNumber: true },
      });
      if (byTax) {
        return {
          id: byTax.id,
          name: byTax.arabicName,
          taxNumber: byTax.taxAuthority || byTax.registrationNumber || tax,
          confidence: 97,
          matched: true,
        };
      }
    }

    const byName = name.trim() ? await prismaWriteCatalog.findSupplierByName(companyId, name) : null;
    if (byName) {
      const score = Math.max(similarity(byName.arabicName, name), 70);
      return {
        id: byName.id,
        name: byName.arabicName,
        taxNumber: tax,
        confidence: score,
        matched: true,
      };
    }

    return {
      name: name.trim() || 'مورد غير معروف',
      taxNumber: tax,
      confidence: 0,
      matched: false,
    };
  }

  async resolveLine(
    companyId: string,
    line: { rawItemName: string; quantity: number; unitPrice: number; total: number }
  ): Promise<ResolvedOcrLine> {
    const catalogItem = await prismaWriteCatalog.findItemByName(companyId, line.rawItemName);
    const score = catalogItem ? similarity(catalogItem.arabicName, line.rawItemName) : 0;
    if (catalogItem && score >= 55) {
      const unit = catalogItem.unitId
        ? { unitId: catalogItem.unitId, conversionFactor: catalogItem.conversionFactor || 1 }
        : await this.ensureItemUnit(companyId, catalogItem.id);
      return {
        rawItemName: line.rawItemName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.total || line.quantity * line.unitPrice,
        itemId: catalogItem.id,
        itemName: catalogItem.arabicName,
        unitId: unit.unitId,
        conversionFactor: unit.conversionFactor,
        taxPercent: catalogItem.isTaxExempt ? 0 : catalogItem.defaultTaxPercent ?? 0,
        matchConfidence: score,
        needsCreation: false,
      };
    }
    return {
      rawItemName: line.rawItemName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.total || line.quantity * line.unitPrice,
      itemName: line.rawItemName,
      conversionFactor: 1,
      taxPercent: 0,
      matchConfidence: catalogItem ? score : 0,
      needsCreation: true,
    };
  }

  async defaultWarehouse(companyId: string) {
    return prisma.warehouse.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, arabicName: true },
    });
  }

  async ensureItemUnit(companyId: string, itemId: string): Promise<{ unitId: string; conversionFactor: number }> {
    const existing = await prisma.itemUnit.findFirst({
      where: { itemId },
      orderBy: { isBaseUnit: 'desc' },
      select: { unitId: true, conversionFactor: true },
    });
    if (existing?.unitId) {
      return { unitId: existing.unitId, conversionFactor: Number(existing.conversionFactor) || 1 };
    }
    let unit = await prisma.unit.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!unit) {
      unit = await prisma.unit.create({
        data: { companyId, code: 'PCS', arabicName: 'قطعة', englishName: 'Piece', isActive: true },
        select: { id: true },
      });
    }
    await prisma.itemUnit.create({
      data: { itemId, unitId: unit.id, isBaseUnit: true, conversionFactor: 1 },
    });
    return { unitId: unit.id, conversionFactor: 1 };
  }
}

export const entityResolverService = new EntityResolverService();
