import type { AiActionLineSummary } from './action-types';
import { resolveItemPrice } from './write-catalog';
import type { CatalogCustomer, CatalogItem, WriteCatalogPort } from './write-catalog.port';

export type DraftLineInput = {
  itemId: string;
  quantity: number;
  unitPrice?: number;
};

export type ResolvedDraftLine = AiActionLineSummary & {
  unitId: string;
  conversionFactor: number;
  taxPercent: number;
  isService: boolean;
};

export async function resolveCustomerAndLines(
  catalog: WriteCatalogPort,
  companyId: string,
  customerId: string,
  items: DraftLineInput[]
): Promise<{ customer: CatalogCustomer; lines: ResolvedDraftLine[] }> {
  const customer = await catalog.findCustomer(companyId, customerId);
  if (!customer) {
    throw new Error('العميل غير موجود في هذه الشركة');
  }

  const catalogItems = await catalog.findItems(
    companyId,
    items.map((line) => line.itemId)
  );
  const byId = new Map(catalogItems.map((item) => [item.id, item]));
  const missing = items.filter((line) => !byId.has(line.itemId));
  if (missing.length) {
    throw new Error('صنف أو أكثر غير موجود في هذه الشركة');
  }

  const lines = items.map((line) => {
    const item = byId.get(line.itemId) as CatalogItem;
    if (!item.unitId) {
      throw new Error(`الصنف «${item.arabicName}» بلا وحدة قياس`);
    }
    const unitPrice = resolveItemPrice(item, customer.priceTier, line.unitPrice);
    const taxPercent = item.isTaxExempt ? 0 : item.defaultTaxPercent ?? 0;
    const lineTotal = roundMoney(line.quantity * unitPrice);
    return {
      itemId: item.id,
      itemName: item.arabicName,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      unitId: item.unitId,
      conversionFactor: item.conversionFactor,
      taxPercent,
      isService: item.isService,
    };
  });

  return { customer, lines };
}

export function totalsFromLines(lines: ResolvedDraftLine[], currency: string) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const tax = roundMoney(
    lines.reduce((sum, line) => sum + line.lineTotal * (line.taxPercent / 100), 0)
  );
  return { subtotal, tax, total: roundMoney(subtotal + tax), currency };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
