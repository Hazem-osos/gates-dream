import prisma from '../../../shared/database/prisma';
import { stockQueryService } from '../../inventory/services/stock-query.service';
import type {
  CatalogCustomer,
  CatalogItem,
  CatalogSafe,
  CatalogSupplier,
  WriteCatalogPort,
} from './write-catalog.port';

function num(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeLookup(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function nameTokens(name: string): string[] {
  return normalizeLookup(name)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreNameMatch(candidate: string, query: string): number {
  const left = normalizeLookup(candidate);
  const right = normalizeLookup(query);
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) return 80;
  const tokens = nameTokens(right);
  if (!tokens.length) return 0;
  const hits = tokens.filter((token) => left.includes(token)).length;
  return hits === 0 ? 0 : 40 + (hits / tokens.length) * 30;
}

export class PrismaWriteCatalog implements WriteCatalogPort {
  async findCustomer(companyId: string, customerId: string): Promise<CatalogCustomer | null> {
    const row = await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      select: {
        id: true,
        arabicName: true,
        currencyCode: true,
        priceTier: true,
        phone1: true,
        mobile: true,
      },
    });
    return row;
  }

  async findCustomerByName(companyId: string, name: string): Promise<CatalogCustomer | null> {
    const query = normalizeLookup(name);
    if (!query) return null;
    const rows = await prisma.customer.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { arabicName: query },
          { englishName: query },
          { arabicName: { contains: query } },
          { englishName: { contains: query } },
          ...nameTokens(query)
            .slice(0, 4)
            .map((token) => ({ arabicName: { contains: token } })),
        ],
      },
      select: {
        id: true,
        arabicName: true,
        englishName: true,
        currencyCode: true,
        priceTier: true,
        phone1: true,
        mobile: true,
      },
      take: 20,
    });
    const best = rows
      .map((row) => ({
        row,
        score: Math.max(scoreNameMatch(row.arabicName, query), scoreNameMatch(row.englishName ?? '', query)),
      }))
      .filter((entry) => entry.score >= 40)
      .sort((a, b) => b.score - a.score)[0];
    if (!best) return null;
    const { englishName: _englishName, ...customer } = best.row;
    return customer;
  }

  async findSupplier(companyId: string, supplierId: string): Promise<CatalogSupplier | null> {
    const row = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId, isActive: true },
      select: { id: true, arabicName: true, currencyCode: true },
    });
    return row;
  }

  async findSupplierByName(companyId: string, name: string): Promise<CatalogSupplier | null> {
    const query = normalizeLookup(name);
    if (!query) return null;
    const rows = await prisma.supplier.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { arabicName: query },
          { englishName: query },
          { arabicName: { contains: query } },
          { englishName: { contains: query } },
          ...nameTokens(query)
            .slice(0, 4)
            .map((token) => ({ arabicName: { contains: token } })),
        ],
      },
      select: { id: true, arabicName: true, englishName: true, currencyCode: true },
      take: 20,
    });
    const best = rows
      .map((row) => ({
        row,
        score: Math.max(scoreNameMatch(row.arabicName, query), scoreNameMatch(row.englishName ?? '', query)),
      }))
      .filter((entry) => entry.score >= 40)
      .sort((a, b) => b.score - a.score)[0];
    if (!best) return null;
    const { englishName: _englishName, ...supplier } = best.row;
    return supplier;
  }

  async findItems(companyId: string, itemIds: string[]): Promise<CatalogItem[]> {
    const unique = [...new Set(itemIds)];
    const rows = await prisma.item.findMany({
      where: { id: { in: unique }, companyId, isActive: true },
      select: {
        id: true,
        arabicName: true,
        isService: true,
        isTaxExempt: true,
        defaultTaxPercent: true,
        priceRetail: true,
        priceSemiWholesale: true,
        priceWholesale: true,
        priceProjects: true,
        retailPrice: true,
        consumerPrice: true,
        units: {
          select: {
            unitId: true,
            isBaseUnit: true,
            conversionFactor: true,
            unit: { select: { arabicName: true } },
          },
          orderBy: { isBaseUnit: 'desc' },
        },
      },
    });

    return rows.map((row) => {
      const unit = row.units.find((u) => u.isBaseUnit) ?? row.units[0];
      return {
        id: row.id,
        arabicName: row.arabicName,
        isService: row.isService,
        isTaxExempt: row.isTaxExempt,
        defaultTaxPercent: row.defaultTaxPercent != null ? num(row.defaultTaxPercent) : null,
        priceRetail: num(row.priceRetail),
        priceSemiWholesale: num(row.priceSemiWholesale),
        priceWholesale: num(row.priceWholesale),
        priceProjects: num(row.priceProjects),
        retailPrice: num(row.retailPrice),
        consumerPrice: num(row.consumerPrice),
        unitId: unit?.unitId ?? '',
        unitName: unit?.unit.arabicName ?? '',
        conversionFactor: num(unit?.conversionFactor ?? 1) || 1,
      };
    });
  }

  async findItemByName(companyId: string, name: string): Promise<CatalogItem | null> {
    const query = normalizeLookup(name);
    if (!query) return null;
    const rows = await prisma.item.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { arabicName: query },
          { englishName: query },
          { arabicName: { contains: query } },
          { englishName: { contains: query } },
          { specifications: { contains: query } },
          ...nameTokens(query)
            .slice(0, 4)
            .map((token) => ({ arabicName: { contains: token } })),
        ],
      },
      select: { id: true, arabicName: true, englishName: true, specifications: true },
      take: 25,
    });
    const best = rows
      .map((row) => ({
        row,
        score: Math.max(
          scoreNameMatch(row.arabicName, query),
          scoreNameMatch(row.englishName ?? '', query),
          scoreNameMatch(row.specifications ?? '', query)
        ),
      }))
      .filter((entry) => entry.score >= 40)
      .sort((a, b) => b.score - a.score)[0];
    if (!best) return null;
    const [item] = await this.findItems(companyId, [best.row.id]);
    return item ?? null;
  }

  async findWarehouse(companyId: string, warehouseId: string) {
    return prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId },
      select: { id: true, arabicName: true },
    });
  }

  async findWarehouseByName(companyId: string, name: string) {
    const query = normalizeLookup(name);
    if (!query) return null;
    const rows = await prisma.warehouse.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { arabicName: query },
          { englishName: query },
          { arabicName: { contains: query } },
          { englishName: { contains: query } },
          ...nameTokens(query)
            .slice(0, 4)
            .map((token) => ({ arabicName: { contains: token } })),
        ],
      },
      select: { id: true, arabicName: true, englishName: true },
      take: 20,
    });
    const best = rows
      .map((row) => ({
        row,
        score: Math.max(scoreNameMatch(row.arabicName, query), scoreNameMatch(row.englishName ?? '', query)),
      }))
      .filter((entry) => entry.score >= 40)
      .sort((a, b) => b.score - a.score)[0];
    return best ? { id: best.row.id, arabicName: best.row.arabicName } : null;
  }

  async findDefaultSafe(companyId: string): Promise<CatalogSafe | null> {
    return prisma.safe.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, arabicName: true },
    });
  }

  async getWarehouseQty(companyId: string, warehouseId: string, itemId: string) {
    return stockQueryService.getWarehouseQuantity(companyId, warehouseId, itemId);
  }

  async findDuplicateCustomer(
    companyId: string,
    input: { phone?: string; taxNumber?: string }
  ) {
    const phone = input.phone?.trim();
    if (phone) {
      const byPhone = await prisma.customer.findFirst({
        where: {
          companyId,
          deletedAt: null,
          OR: [{ phone1: phone }, { phone2: phone }, { mobile: phone }],
        },
        select: { id: true, arabicName: true },
      });
      if (byPhone) return { ...byPhone, field: 'phone' as const };
    }
    const taxNumber = input.taxNumber?.trim();
    if (taxNumber) {
      const byTax = await prisma.customer.findFirst({
        where: { companyId, deletedAt: null, taxAuthority: taxNumber },
        select: { id: true, arabicName: true },
      });
      if (byTax) return { ...byTax, field: 'taxNumber' as const };
    }
    return null;
  }
}

export const prismaWriteCatalog = new PrismaWriteCatalog();

export function resolveItemPrice(item: CatalogItem, priceTier?: string | null, override?: number) {
  if (override != null && Number.isFinite(override) && override >= 0) return override;
  const tier = (priceTier ?? 'RETAIL').toUpperCase();
  if (tier === 'WHOLESALE') return item.priceWholesale || item.priceRetail || item.retailPrice;
  if (tier === 'SEMI_WHOLESALE') return item.priceSemiWholesale || item.priceRetail || item.retailPrice;
  if (tier === 'PROJECTS') return item.priceProjects || item.priceRetail || item.retailPrice;
  return item.priceRetail || item.retailPrice || item.consumerPrice;
}
