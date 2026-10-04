import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import { itemCostService } from '../inventory/services/item-cost.service';
import {
  combinedPriceListDiscountPercent,
  resolveUnitPriceFromPriceListRow,
  type PriceListPricingKind,
} from '../inventory/services/party-price-list-pricing';
import { transactionSettingsService } from './transaction-settings.service';
import type { PricingPolicy } from './transaction-settings.schema';

export type PricingPolicyResult = {
  policy: PricingPolicy;
  unitPrice: number;
  discountPercent: number;
  source:
    | 'COST'
    | 'LAST_PURCHASE'
    | 'LAST_SALE'
    | 'LAST_SALE_TO_CUSTOMER'
    | 'CATALOG'
    | 'PRICE_LIST';
  priceMode?: string | null;
};

async function lastInvoiceLinePrice(params: {
  companyId: string;
  itemId: string;
  invoiceKind: 'SALE' | 'PURCHASE';
  customerId?: string;
  supplierId?: string;
}): Promise<number | null> {
  const line = await prisma.invoiceLine.findFirst({
    where: {
      itemId: params.itemId,
      invoice: {
        companyId: params.companyId,
        invoiceKind: params.invoiceKind,
        isPosted: true,
        isCancelled: false,
        ...(params.customerId ? { customerId: params.customerId } : {}),
        ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      },
    },
    orderBy: [{ invoice: { date: 'desc' } }],
    select: { price: true },
  });
  return line ? Number(line.price) : null;
}

async function resolvePartyPriceListContext(
  companyId: string,
  kind: PriceListPricingKind,
  ids: { customerId?: string; supplierId?: string; priceListId?: string }
): Promise<{ listId?: string; partyDiscountRaw?: string | null }> {
  if (ids.priceListId) return { listId: ids.priceListId };
  if (kind === 'sale' && ids.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: ids.customerId, companyId },
      select: { priceListId: true, sellingPrice: true },
    });
    return {
      listId: customer?.priceListId ?? undefined,
      partyDiscountRaw: customer?.sellingPrice,
    };
  }
  if (kind === 'purchase' && ids.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: ids.supplierId, companyId },
      select: { priceListId: true, discountType: true },
    });
    return {
      listId: supplier?.priceListId ?? undefined,
      partyDiscountRaw: supplier?.discountType,
    };
  }
  return {};
}

async function resolveFromPriceList(params: {
  companyId: string;
  itemId: string;
  kind: PriceListPricingKind;
  listId?: string;
  partyDiscountRaw?: string | null;
  unitId?: string;
  cost: number;
  lastPurchase: number;
}): Promise<PricingPolicyResult | null> {
  const whereList = {
    itemId: params.itemId,
    priceList: {
      companyId: params.companyId,
      isActive: true,
      ...(params.listId ? { id: params.listId } : {}),
    },
  };
  const include = {
    priceList: { select: { id: true, priceMode: true, discountPercentage: true } },
  } as const;

  let row = params.unitId
    ? await prisma.itemPrice.findFirst({
        where: { ...whereList, unitId: params.unitId },
        include,
      })
    : null;
  if (!row) {
    const rows = await prisma.itemPrice.findMany({
      where: whereList,
      include,
      take: params.listId ? 1 : 2,
      orderBy: { id: 'asc' },
    });
    if (!rows.length) return null;
    if (!params.listId && rows.length !== 1) return null;
    row = rows[0];
  }

  const unitPrice = resolveUnitPriceFromPriceListRow(params.kind, row, {
    cost: params.cost,
    lastPurchase: params.lastPurchase,
  });
  if (unitPrice <= 0) return null;

  const discountPercent = combinedPriceListDiscountPercent({
    lineDiscount: row.discount,
    listDiscountPercentage: row.priceList.discountPercentage,
    partyDiscountRaw: params.partyDiscountRaw,
  });

  return {
    policy: 'LAST_SALE',
    unitPrice,
    discountPercent,
    source: 'PRICE_LIST',
    priceMode: row.priceList.priceMode,
  };
}

export async function resolveItemPricingPolicy(params: {
  companyId: string;
  itemId: string;
  customerId?: string;
  supplierId?: string;
  priceListId?: string;
  unitId?: string;
  policy?: PricingPolicy;
  kind?: PriceListPricingKind;
}): Promise<PricingPolicyResult> {
  const kind: PriceListPricingKind = params.kind ?? 'sale';
  const item = await prisma.item.findFirst({
    where: { id: params.itemId, companyId: params.companyId },
    select: {
      id: true,
      averageCost: true,
      lastPurchasePrice: true,
      consumerPrice: true,
      retailPrice: true,
      priceRetail: true,
    },
  });
  if (!item) throw new AppError(404, 'الصنف غير موجود');

  const settingsDoc = kind === 'purchase' ? 'PURCHASE_INVOICE' : 'SALES_INVOICE';
  const settings = await transactionSettingsService.getOrCreate(params.companyId, settingsDoc);
  const policy = params.policy ?? settings.pricingPolicy;

  const asOfCost = await itemCostService.getCostAsOf(params.companyId, item.id, new Date());
  const cost = asOfCost || Number(item.averageCost ?? 0);
  const fromPurchaseInvoice = await lastInvoiceLinePrice({
    companyId: params.companyId,
    itemId: item.id,
    invoiceKind: 'PURCHASE',
  });
  const lastPurchase = fromPurchaseInvoice ?? Number(item.lastPurchasePrice ?? 0);

  const partyCtx = await resolvePartyPriceListContext(params.companyId, kind, {
    customerId: params.customerId,
    supplierId: params.supplierId,
    priceListId: params.priceListId,
  });

  const fromList = await resolveFromPriceList({
    companyId: params.companyId,
    itemId: item.id,
    kind,
    listId: partyCtx.listId,
    partyDiscountRaw: partyCtx.partyDiscountRaw,
    unitId: params.unitId,
    cost,
    lastPurchase,
  });
  if (fromList) return { ...fromList, policy };

  const catalog =
    kind === 'purchase'
      ? lastPurchase ||
        Number(item.lastPurchasePrice ?? 0) ||
        cost
      : Number(item.consumerPrice || 0) ||
        Number(item.retailPrice || 0) ||
        Number(item.priceRetail || 0);

  if (policy === 'COST') {
    return { policy, unitPrice: cost, discountPercent: 0, source: 'COST' };
  }

  if (policy === 'LAST_PURCHASE') {
    const unitPrice = lastPurchase || catalog;
    return { policy, unitPrice, discountPercent: 0, source: 'LAST_PURCHASE' };
  }

  if (kind === 'sale' && policy === 'LAST_SALE_TO_CUSTOMER' && params.customerId) {
    const customerPrice = await lastInvoiceLinePrice({
      companyId: params.companyId,
      itemId: item.id,
      invoiceKind: 'SALE',
      customerId: params.customerId,
    });
    if (customerPrice != null) {
      return {
        policy,
        unitPrice: customerPrice,
        discountPercent: 0,
        source: 'LAST_SALE_TO_CUSTOMER',
      };
    }
  }

  if (kind === 'purchase' && params.supplierId) {
    const supplierPrice = await lastInvoiceLinePrice({
      companyId: params.companyId,
      itemId: item.id,
      invoiceKind: 'PURCHASE',
      supplierId: params.supplierId,
    });
    if (supplierPrice != null) {
      return { policy, unitPrice: supplierPrice, discountPercent: 0, source: 'LAST_PURCHASE' };
    }
  }

  const lastSale = await lastInvoiceLinePrice({
    companyId: params.companyId,
    itemId: item.id,
    invoiceKind: 'SALE',
  });
  if (kind === 'sale' && lastSale != null) {
    return {
      policy: policy === 'LAST_SALE_TO_CUSTOMER' ? 'LAST_SALE' : policy,
      unitPrice: lastSale,
      discountPercent: 0,
      source: 'LAST_SALE',
    };
  }

  return { policy, unitPrice: catalog, discountPercent: 0, source: 'CATALOG' };
}
