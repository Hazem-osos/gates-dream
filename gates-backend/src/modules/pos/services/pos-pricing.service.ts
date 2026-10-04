import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { userPermissionsService } from '../../users/services/user-permissions.service';
import { itemOfferService } from '../../inventory/services/item-offer.service';
import type { PosOrderLineInput } from '../types/pos.types';
import { combinedPriceListDiscountPercent } from '../../inventory/services/party-price-list-pricing';

/**
 * Same rules as gates-web/lib/inventory/pricing-engine.ts
 * (`applyPriceListMode`, `resolvePriceListSalePrice`, `resolveUnitPrice`).
 * The API cannot import the web module, so the arithmetic lives here and
 * the inputs are ItemPrice, PriceList.priceMode, and the item tier columns.
 */
function money4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function applyPriceListMode(
  listed: number,
  mode: string | null | undefined,
  bases: { averageCost?: number; lastPurchasePrice?: number }
): number {
  if (!Number.isFinite(listed) || listed <= 0) return 0;
  if (mode === 'cost') {
    const cost = Number(bases.averageCost ?? 0);
    return cost > 0 ? money4(cost * (listed / 100)) : 0;
  }
  if (mode === 'last') {
    const last = Number(bases.lastPurchasePrice ?? 0);
    return last > 0 ? money4(last * (listed / 100)) : 0;
  }
  return money4(listed);
}

type PriceRow = {
  itemId: string;
  unitId: string;
  price: unknown;
  retailPrice: unknown;
  priceList: { priceMode: string | null; isActive: boolean } | null;
};

export function priceFromListRow(
  row: PriceRow | undefined,
  bases: { averageCost?: number; lastPurchasePrice?: number }
): number {
  if (!row || row.priceList?.isActive === false) return 0;
  const retail = Number(row.retailPrice ?? 0);
  const listed = Number.isFinite(retail) && retail > 0 ? retail : Number(row.price ?? 0);
  return applyPriceListMode(listed, row.priceList?.priceMode, bases);
}

export function tierPrice(
  tier: string | null | undefined,
  item: {
    priceRetail?: unknown;
    priceSemiWholesale?: unknown;
    priceWholesale?: unknown;
    priceProjects?: unknown;
  }
): number {
  const pick = (value: unknown) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  switch (tier) {
    case 'SEMI_WHOLESALE':
      return pick(item.priceSemiWholesale);
    case 'WHOLESALE':
      return pick(item.priceWholesale);
    case 'PROJECTS':
      return pick(item.priceProjects);
    case 'RETAIL':
    default:
      return pick(item.priceRetail);
  }
}

export async function canOverridePosPrice(companyId: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  const onPos = await userPermissionsService.checkUserPermission(
    companyId,
    userId,
    'pos',
    'override_tier_price'
  );
  if (onPos) return true;
  return userPermissionsService.checkUserPermission(
    companyId,
    userId,
    'invoice',
    'override_tier_price'
  );
}

export async function canDiscountPos(companyId: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  return userPermissionsService.checkUserPermission(companyId, userId, 'pos', 'discount');
}

export type PosPricingFlags = {
  trustPrice: boolean;
  trustDiscount: boolean;
  /** HTTP callers get 403. Internal posts that predate the permission strip the client value. */
  rejectUnauthorized: boolean;
};

export type PosPriceLineInput = {
  itemId: string;
  unitId: string;
  quantity: number;
  price?: number;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  lineOrder: number;
  notes?: string | null;
  isGift?: boolean;
  batchNumber?: string | null;
  serialNo?: string | null;
  expiryDate?: string | null;
};

/**
 * Fills price, discount, and tax from the customer's price list, the item
 * tier, and applicable sales offers. A client price is kept only when
 * `trustClientPrice` is set by a granted override permission.
 */
export async function resolvePosLines(
  companyId: string,
  customerId: string | null | undefined,
  lines: PosPriceLineInput[],
  trustOrFlags: boolean | PosPricingFlags
): Promise<PosOrderLineInput[]> {
  const flags: PosPricingFlags =
    typeof trustOrFlags === 'boolean'
      ? { trustPrice: trustOrFlags, trustDiscount: trustOrFlags, rejectUnauthorized: false }
      : trustOrFlags;
  const customer = customerId
    ? await prisma.customer.findFirst({
        where: { id: customerId, companyId, deletedAt: null },
        select: { id: true, priceListId: true, priceTier: true, sellingPrice: true },
      })
    : null;

  const itemIds = [...new Set(lines.map((line) => line.itemId))];
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds }, companyId },
    select: {
      id: true,
      averageCost: true,
      lastPurchasePrice: true,
      priceRetail: true,
      priceSemiWholesale: true,
      priceWholesale: true,
      priceProjects: true,
      defaultTaxPercent: true,
      category: { select: { taxRate: true, isTaxExempt: true } },
    },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));

  const listPrices = customer?.priceListId
    ? await prisma.itemPrice.findMany({
        where: { itemId: { in: itemIds }, priceListId: customer.priceListId },
        include: {
          priceList: { select: { priceMode: true, isActive: true, discountPercentage: true } },
        },
      })
    : [];

  const resolved: PosOrderLineInput[] = [];
  for (const line of lines) {
    const item = itemById.get(line.itemId);
    if (!item) throw new AppError(422, 'POS line item was not found in this company');
    const bases = {
      averageCost: Number(item.averageCost),
      lastPurchasePrice: Number(item.lastPurchasePrice),
    };
    const listRow = listPrices.find(
      (row) => row.itemId === line.itemId && row.unitId === line.unitId
    ) as PriceRow | undefined;
    const fromList = priceFromListRow(listRow, bases);
    const fromTier = tierPrice(customer?.priceTier, item);
    const serverPrice = fromList > 0 ? fromList : fromTier;
    const taxPercent = item.category?.isTaxExempt
      ? 0
      : Number(item.defaultTaxPercent ?? item.category?.taxRate ?? 0);

    const clientDiscount =
      (line.discountPercent != null && line.discountPercent !== 0) ||
      (line.discountAmount != null && line.discountAmount !== 0);
    if (clientDiscount && !flags.trustDiscount) {
      if (flags.rejectUnauthorized) {
        throw new AppError(403, 'POS manual discount is not permitted');
      }
    }
    let discountPercent: number | undefined;
    let discountAmount: number | undefined;
    let offers: Array<{ id: string; how: string; toItemId?: string | null; offerQuantity?: unknown; unitId?: string | null; nameAr?: string | null; percentage?: unknown }> = [];
    if (flags.trustDiscount && (line.discountPercent != null || line.discountAmount != null)) {
      discountPercent = line.discountPercent;
      discountAmount = line.discountPercent == null ? line.discountAmount : undefined;
    } else if (!clientDiscount || !flags.trustDiscount) {
      if (listRow) {
        const fromList = combinedPriceListDiscountPercent({
          lineDiscount: listRow.discount,
          listDiscountPercentage: listRow.priceList?.discountPercentage,
          partyDiscountRaw: customer?.sellingPrice,
        });
        if (fromList > 0) discountPercent = fromList;
      }
      offers = await itemOfferService.getApplicableOffers(
        companyId,
        line.itemId,
        line.quantity,
        'sales',
        undefined,
        line.unitId,
        undefined,
        new Date(),
        customer?.id
      );
      const percentOffer = offers.find(
        (offer) => offer.how === 'discount-percentage' && offer.percentage != null
      );
      if (percentOffer?.percentage != null) discountPercent = Number(percentOffer.percentage);
    }

    const clientPrice =
      line.price != null && Number.isFinite(line.price) && Math.abs(line.price - serverPrice) > 0.0001;
    if (clientPrice && !flags.trustPrice) {
      if (flags.rejectUnauthorized) {
        throw new AppError(403, 'POS price override is not permitted');
      }
    }
    const price = flags.trustPrice && line.price != null && Number.isFinite(line.price) ? line.price : serverPrice;

    resolved.push({
      itemId: line.itemId,
      unitId: line.unitId,
      quantity: line.quantity,
      price,
      listPrice: serverPrice,
      discountPercent,
      discountAmount,
      taxPercent,
      lineOrder: line.lineOrder,
      batchNumber: line.batchNumber,
      serialNo: line.serialNo,
      expiryDate: line.expiryDate,
    });
    if (!line.isGift) {
      const gift = offers?.find((offer) => offer.how === 'additional-quantity' && offer.toItemId && offer.offerQuantity);
      if (gift?.toItemId && gift.offerQuantity) {
        const giftUnit = gift.unitId
          ? gift.unitId
          : (await prisma.itemUnit.findFirst({ where: { itemId: gift.toItemId, isBaseUnit: true }, select: { unitId: true } }))?.unitId;
        if (giftUnit) {
          resolved.push({
            itemId: gift.toItemId,
            unitId: giftUnit,
            quantity: Number(gift.offerQuantity),
            price: 0,
            listPrice: 0,
            taxPercent: 0,
            lineOrder: line.lineOrder + 1000,
            isGift: true,
            offerId: gift.id,
            notes: gift.nameAr || 'عرض كمية',
          });
        }
      }
    }
  }
  return resolved;
}
