import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { priceFromListRow, tierPrice } from './pos-pricing.service';
import { decodeWeightedBarcode } from './pos-barcode';

const DEFAULT_TAKE = 24;
const MAX_TAKE = 48;

async function customerPricing(companyId: string, customerId?: string | null) {
  if (!customerId) return { priceListId: null as string | null, priceTier: 'RETAIL' as string };
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId, deletedAt: null },
    select: { priceListId: true, priceTier: true, creditLimit: true, arabicName: true },
  });
  if (!customer) throw new AppError(404, 'Customer not found');
  return customer;
}

function shapeItem(
  item: {
    id: string;
    arabicName: string;
    barcode: string | null;
    serial: string | null;
    categoryId: string | null;
    averageCost: unknown;
    lastPurchasePrice: unknown;
    priceRetail: unknown;
    priceSemiWholesale: unknown;
    priceWholesale: unknown;
    priceProjects: unknown;
    defaultTaxPercent: unknown;
    units: Array<{ unitId: string; unit: { arabicName: string; code: string | null } }>;
    category: { taxRate: unknown; isTaxExempt: boolean } | null;
  },
  listRow: { price: unknown; retailPrice: unknown; priceList: { priceMode: string | null; isActive: boolean } | null } | undefined,
  priceTier: string | null | undefined,
  onHand: number | null
) {
  const unit = item.units[0];
  const bases = {
    averageCost: Number(item.averageCost),
    lastPurchasePrice: Number(item.lastPurchasePrice),
  };
  const fromList = priceFromListRow(
    listRow
      ? {
          itemId: item.id,
          unitId: unit?.unitId ?? '',
          price: listRow.price,
          retailPrice: listRow.retailPrice,
          priceList: listRow.priceList,
        }
      : undefined,
    bases
  );
  const price = fromList > 0 ? fromList : tierPrice(priceTier, item);
  const taxPercent = item.category?.isTaxExempt
    ? 0
    : Number(item.defaultTaxPercent ?? item.category?.taxRate ?? 0);
  return {
    id: item.id,
    arabicName: item.arabicName,
    barcode: item.barcode,
    serial: item.serial,
    categoryId: item.categoryId,
    unitId: unit?.unitId ?? null,
    unitName: unit?.unit.arabicName || unit?.unit.code || '',
    price,
    taxPercent,
    onHand,
  };
}

const itemSelect = {
  id: true,
  arabicName: true,
  barcode: true,
  serial: true,
  categoryId: true,
  averageCost: true,
  lastPurchasePrice: true,
  priceRetail: true,
  priceSemiWholesale: true,
  priceWholesale: true,
  priceProjects: true,
  defaultTaxPercent: true,
  units: {
    where: { isBaseUnit: true },
    take: 1,
    include: { unit: { select: { arabicName: true, code: true } } },
  },
  category: { select: { taxRate: true, isTaxExempt: true } },
} as const;

export class PosCatalogService {
  async categories(companyId: string) {
    return prisma.itemCategory.findMany({
      where: { companyId, isActive: true },
      select: { id: true, arabicName: true },
      orderBy: { arabicName: 'asc' },
      take: 200,
    });
  }

  async search(params: {
    companyId: string;
    warehouseId?: string;
    customerId?: string;
    q?: string;
    categoryId?: string;
    cursor?: string;
    take?: number;
  }) {
    const take = Math.min(Math.max(params.take ?? DEFAULT_TAKE, 1), MAX_TAKE);
    const pricing = await customerPricing(params.companyId, params.customerId);
    const q = params.q?.trim();
    const items = await prisma.item.findMany({
      where: {
        companyId: params.companyId,
        isActive: true,
        inactiveItem: false,
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params.cursor ? { id: { gt: params.cursor } } : {}),
        ...(q
          ? {
              OR: [
                { arabicName: { contains: q } },
                { englishName: { contains: q } },
                { barcode: q },
                { serial: q },
              ],
            }
          : {}),
      },
      select: itemSelect,
      orderBy: { id: 'asc' },
      take: take + 1,
    });
    const page = items.slice(0, take);
    const nextCursor = items.length > take ? page[page.length - 1]?.id ?? null : null;
    const shaped = await this.withPricesAndStock(params.companyId, params.warehouseId, pricing, page);
    return { items: shaped, nextCursor };
  }

  async barcode(params: {
    companyId: string;
    code: string;
    warehouseId?: string;
    customerId?: string;
  }) {
    const code = params.code.trim();
    if (!code) throw new AppError(400, 'Barcode is required');
    const rules = await prisma.posBarcodeRule.findMany({ where: { companyId: params.companyId, isActive: true } });
    const decoded = decodeWeightedBarcode(code, rules);
    const lookup = decoded?.itemCode || code;
    const pricing = await customerPricing(params.companyId, params.customerId);
    const extra = await prisma.itemBarcode.findFirst({
      where: { companyId: params.companyId, barcode: lookup },
      select: { itemId: true, unitId: true },
    });
    const item = await prisma.item.findFirst({
      where: extra
        ? { id: extra.itemId, companyId: params.companyId, isActive: true }
        : {
            companyId: params.companyId,
            isActive: true,
            OR: [{ barcode: lookup }, { serial: lookup }],
          },
      select: itemSelect,
    });
    if (!item || item.units.length === 0) return null;
    const [shaped] = await this.withPricesAndStock(params.companyId, params.warehouseId, pricing, [item]);
    if (!shaped) return null;
    if (decoded?.embeddedPrice != null && Math.abs(decoded.embeddedPrice - Number(shaped.price)) > 0.05) {
      throw new AppError(422, 'Embedded barcode price does not match the server price');
    }
    return {
      ...shaped,
      unitId: extra?.unitId ?? shaped.unitId,
      scannedQuantity: decoded?.quantity ?? null,
    };
  }

  async customers(companyId: string, q?: string) {
    const term = q?.trim();
    return prisma.customer.findMany({
      where: {
        companyId,
        deletedAt: null,
        isActive: true,
        ...(term
          ? {
              OR: [
                { arabicName: { contains: term } },
                { code: { contains: term } },
                { mobile: { contains: term } },
                { phone1: { contains: term } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        arabicName: true,
        mobile: true,
        priceListId: true,
        priceTier: true,
        creditLimit: true,
      },
      orderBy: { arabicName: 'asc' },
      take: 20,
    });
  }

  private async withPricesAndStock(
    companyId: string,
    warehouseId: string | undefined,
    pricing: { priceListId?: string | null; priceTier?: string | null },
    items: Array<{
      id: string;
      arabicName: string;
      barcode: string | null;
      serial: string | null;
      categoryId: string | null;
      averageCost: unknown;
      lastPurchasePrice: unknown;
      priceRetail: unknown;
      priceSemiWholesale: unknown;
      priceWholesale: unknown;
      priceProjects: unknown;
      defaultTaxPercent: unknown;
      units: Array<{ unitId: string; unit: { arabicName: string; code: string | null } }>;
      category: { taxRate: unknown; isTaxExempt: boolean } | null;
    }>
  ) {
    const ids = items.map((item) => item.id);
    const [prices, stock] = await Promise.all([
      pricing.priceListId && ids.length
        ? prisma.itemPrice.findMany({
            where: { priceListId: pricing.priceListId, itemId: { in: ids } },
            include: { priceList: { select: { priceMode: true, isActive: true } } },
          })
        : Promise.resolve([]),
      warehouseId && ids.length
        ? prisma.itemWarehouseBalance.findMany({
            where: { companyId, warehouseId, itemId: { in: ids } },
            select: { itemId: true, quantityOnHand: true, reservedQuantity: true },
          })
        : Promise.resolve([]),
    ]);
    const stockByItem = new Map(
      stock.map((row) => {
        const onHand = Number(row.quantityOnHand);
        const reserved = Number(row.reservedQuantity);
        return [row.itemId, Math.max(0, onHand - reserved)] as const;
      })
    );
    return items.map((item) => {
      const unitId = item.units[0]?.unitId;
      const listRow = prices.find((row) => row.itemId === item.id && row.unitId === unitId);
      return shapeItem(
        item,
        listRow,
        pricing.priceTier,
        warehouseId ? (stockByItem.get(item.id) ?? 0) : null
      );
    });
  }
}

export const posCatalogService = new PosCatalogService();
