import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import { itemCostService } from '../inventory/services/item-cost.service';
import { applyPriceListMode, listedSaleAmount } from '../inventory/services/price-list-mode';
import { transactionSettingsService } from './transaction-settings.service';
import type { PricingPolicy } from './transaction-settings.schema';

export type PricingPolicyResult = {
  policy: PricingPolicy;
  unitPrice: number;
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
      },
    },
    orderBy: [{ invoice: { date: 'desc' } }],
    select: { price: true },
  });
  return line ? Number(line.price) : null;
}

async function resolveFromPriceList(params: {
  companyId: string;
  itemId: string;
  customerId?: string;
  priceListId?: string;
  unitId?: string;
  cost: number;
  lastPurchase: number;
}): Promise<PricingPolicyResult | null> {
  let listId = params.priceListId;
  if (!listId && params.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, companyId: params.companyId },
      select: { priceListId: true },
    });
    listId = customer?.priceListId ?? undefined;
  }

  const whereList = {
    itemId: params.itemId,
    priceList: {
      companyId: params.companyId,
      isActive: true,
      ...(listId ? { id: listId } : {}),
    },
  };
  const include = {
    priceList: { select: { id: true, priceMode: true } },
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
      take: listId ? 1 : 2,
      orderBy: { id: 'asc' },
    });
    if (!rows.length) return null;
    if (!listId && rows.length !== 1) return null;
    row = rows[0];
  }

  const listed = listedSaleAmount(row);
  const unitPrice = applyPriceListMode(listed, row.priceList.priceMode, {
    cost: params.cost,
    lastPurchase: params.lastPurchase,
  });
  if (unitPrice <= 0) return null;
  return {
    policy: 'LAST_SALE',
    unitPrice,
    source: 'PRICE_LIST',
    priceMode: row.priceList.priceMode,
  };
}

export async function resolveItemPricingPolicy(params: {
  companyId: string;
  itemId: string;
  customerId?: string;
  priceListId?: string;
  unitId?: string;
  policy?: PricingPolicy;
}): Promise<PricingPolicyResult> {
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

  const settings = await transactionSettingsService.getOrCreate(params.companyId, 'SALES_INVOICE');
  const policy = params.policy ?? settings.pricingPolicy;

  const asOfCost = await itemCostService.getCostAsOf(params.companyId, item.id, new Date());
  const cost = asOfCost || Number(item.averageCost ?? 0);
  const fromPurchaseInvoice = await lastInvoiceLinePrice({
    companyId: params.companyId,
    itemId: item.id,
    invoiceKind: 'PURCHASE',
  });
  const lastPurchase = fromPurchaseInvoice ?? Number(item.lastPurchasePrice ?? 0);

  const fromList = await resolveFromPriceList({
    companyId: params.companyId,
    itemId: item.id,
    customerId: params.customerId,
    priceListId: params.priceListId,
    unitId: params.unitId,
    cost,
    lastPurchase,
  });
  if (fromList) return { ...fromList, policy };

  const catalog =
    Number(item.consumerPrice || 0) ||
    Number(item.retailPrice || 0) ||
    Number(item.priceRetail || 0);

  if (policy === 'COST') {
    return { policy, unitPrice: cost, source: 'COST' };
  }

  if (policy === 'LAST_PURCHASE') {
    const unitPrice = lastPurchase || catalog;
    return { policy, unitPrice, source: 'LAST_PURCHASE' };
  }

  if (policy === 'LAST_SALE_TO_CUSTOMER' && params.customerId) {
    const customerPrice = await lastInvoiceLinePrice({
      companyId: params.companyId,
      itemId: item.id,
      invoiceKind: 'SALE',
      customerId: params.customerId,
    });
    if (customerPrice != null) {
      return { policy, unitPrice: customerPrice, source: 'LAST_SALE_TO_CUSTOMER' };
    }
  }

  const lastSale = await lastInvoiceLinePrice({
    companyId: params.companyId,
    itemId: item.id,
    invoiceKind: 'SALE',
  });
  if (lastSale != null) {
    return {
      policy: policy === 'LAST_SALE_TO_CUSTOMER' ? 'LAST_SALE' : policy,
      unitPrice: lastSale,
      source: 'LAST_SALE',
    };
  }

  return { policy, unitPrice: catalog, source: 'CATALOG' };
}
