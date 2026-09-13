export enum PromotionTargetType {
  SALES = 'SALES',
  PURCHASES = 'PURCHASES',
}

export type PromotionType = 'BUY_X_GET_Y' | 'DISCOUNT_PERCENTAGE' | 'INVOICE_TOTAL_THRESHOLD';

export interface CreateItemPromotionDto {
  nameAr: string;
  description?: string;
  startDate: Date | string;
  endDate: Date | string;
  hijriStartDate?: string;
  hijriEndDate?: string;
  targetType: PromotionTargetType;

  promotionType: PromotionType;
  sourceItemId?: string;
  sourceQuantity?: number;
  giftItemId?: string;
  giftQuantity?: number;
  invoiceThresholdAmount?: number;
  discountPercentage?: number;

  applyToAllParties: boolean;
  targetPartyIds: string[];
  applyToAllPatterns: boolean;
  targetPatternIds: string[];
}

export const PROMOTION_TYPE_TO_HOW = {
  BUY_X_GET_Y: 'additional-quantity',
  DISCOUNT_PERCENTAGE: 'discount-percentage',
  INVOICE_TOTAL_THRESHOLD: 'invoice-value',
} as const;

export const HOW_TO_PROMOTION_TYPE = {
  'additional-quantity': 'BUY_X_GET_Y',
  'discount-percentage': 'DISCOUNT_PERCENTAGE',
  'invoice-value': 'INVOICE_TOTAL_THRESHOLD',
} as const;

export function toOfferType(targetType?: string): 'sales' | 'purchases' | undefined {
  if (targetType === PromotionTargetType.SALES || targetType === 'sales') return 'sales';
  if (targetType === PromotionTargetType.PURCHASES || targetType === 'purchases') return 'purchases';
  return undefined;
}

export function toIsoDateTime(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function normalizePromotionPayload(raw: Record<string, unknown>) {
  const promotionType = raw.promotionType as PromotionType | undefined;
  const how =
    (raw.how as string | undefined) ||
    (promotionType ? PROMOTION_TYPE_TO_HOW[promotionType] : undefined);
  const type = toOfferType(String(raw.targetType ?? raw.type ?? '')) || (raw.type as string | undefined);
  const fromItemId = (raw.fromItemId ?? raw.sourceItemId) as string | undefined;
  const toItemId = (raw.toItemId ?? raw.giftItemId) as string | undefined;
  const rawQty = raw.quantity ?? raw.sourceQuantity;
  const quantity =
    rawQty != null && rawQty !== ''
      ? Number(rawQty)
      : how === 'invoice-value'
        ? 1
        : undefined;
  const offerQuantity = raw.offerQuantity ?? raw.giftQuantity;
  const invoiceValue = raw.invoiceValue ?? raw.invoiceThresholdAmount;
  const percentage = raw.percentage ?? raw.discountPercentage;
  const fromDate = toIsoDateTime(raw.fromDate ?? raw.startDate);
  const toDate = toIsoDateTime(raw.toDate ?? raw.endDate);
  const applyToAllParties = raw.applyToAllParties !== false && raw.applyToAllParties !== 'false';
  const applyToAllPatterns = raw.applyToAllPatterns !== false && raw.applyToAllPatterns !== 'false';
  const targetPartyIds = Array.isArray(raw.targetPartyIds) ? raw.targetPartyIds.map(String) : [];
  const targetPatternIds = Array.isArray(raw.targetPatternIds) ? raw.targetPatternIds.map(String) : [];

  let source = raw.source as string | undefined;
  if (!source) {
    if (!applyToAllParties) source = type === 'sales' ? 'customers' : 'suppliers';
    else if (!applyToAllPatterns) source = 'input-units';
    else source = 'all';
  }

  return {
    nameAr: typeof raw.nameAr === 'string' ? raw.nameAr : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    serial: typeof raw.serial === 'string' ? raw.serial : undefined,
    how,
    type,
    source,
    fromItemId: fromItemId || undefined,
    quantity: quantity != null && Number.isFinite(quantity) ? quantity : undefined,
    percentage: percentage != null && percentage !== '' ? Number(percentage) : undefined,
    offerQuantity: offerQuantity != null && offerQuantity !== '' ? Number(offerQuantity) : undefined,
    toItemId: toItemId || undefined,
    invoiceValue: invoiceValue != null && invoiceValue !== '' ? Number(invoiceValue) : undefined,
    supplierId: (raw.supplierId as string | undefined) || undefined,
    unitId: (raw.unitId as string | undefined) || undefined,
    applyToAllParties,
    applyToAllPatterns,
    targetPartyIds,
    targetPatternIds,
    fromDate,
    toDate,
    fromDateHijri: (raw.fromDateHijri ?? raw.hijriStartDate) as string | undefined,
    toDateHijri: (raw.toDateHijri ?? raw.hijriEndDate) as string | undefined,
    isActive: raw.isActive !== false && raw.isActive !== 'false',
    branchId: (raw.branchId as string | undefined) || undefined,
  };
}
