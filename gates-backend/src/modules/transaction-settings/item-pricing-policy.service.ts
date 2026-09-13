import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import { itemCostService } from '../inventory/services/item-cost.service';
import { transactionSettingsService } from './transaction-settings.service';
import type { PricingPolicy } from './transaction-settings.schema';

export type PricingPolicyResult = {
  policy: PricingPolicy;
  unitPrice: number;
  source: 'COST' | 'LAST_PURCHASE' | 'LAST_SALE' | 'LAST_SALE_TO_CUSTOMER' | 'CATALOG';
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

export async function resolveItemPricingPolicy(params: {
  companyId: string;
  itemId: string;
  customerId?: string;
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

  const catalog =
    Number(item.consumerPrice || 0) ||
    Number(item.retailPrice || 0) ||
    Number(item.priceRetail || 0);

  if (policy === 'COST') {
    const asOf = await itemCostService.getCostAsOf(params.companyId, item.id, new Date());
    const unitPrice = asOf || Number(item.averageCost ?? 0);
    return { policy, unitPrice, source: 'COST' };
  }

  if (policy === 'LAST_PURCHASE') {
    const fromInvoice = await lastInvoiceLinePrice({
      companyId: params.companyId,
      itemId: item.id,
      invoiceKind: 'PURCHASE',
    });
    const unitPrice = fromInvoice ?? (Number(item.lastPurchasePrice ?? 0) || catalog);
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
