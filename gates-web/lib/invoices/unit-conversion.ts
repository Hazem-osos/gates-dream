export const PRICING_CALCULATION_BASES = ['SELECTED_UNIT_QTY', 'BASE_UNIT_QTY'] as const;
export type PricingCalculationBasis = (typeof PRICING_CALCULATION_BASES)[number];

export const PRICING_CALCULATION_BASIS_LABELS: Record<PricingCalculationBasis, string> = {
  SELECTED_UNIT_QTY: 'كمية الوحدة المختارة',
  BASE_UNIT_QTY: 'كمية الوحدة الأساسية',
};

export function parsePricingCalculationBasis(value: unknown): PricingCalculationBasis {
  return value === 'BASE_UNIT_QTY' ? 'BASE_UNIT_QTY' : 'SELECTED_UNIT_QTY';
}

export function resolvePricedQuantity(
  quantity: number,
  baseQuantity: number | undefined,
  basis: PricingCalculationBasis
): number {
  if (basis === 'BASE_UNIT_QTY') {
    const base = Number(baseQuantity);
    return Number.isFinite(base) && base > 0 ? base : Number(quantity) || 0;
  }
  return Number(quantity) || 0;
}

export function computeBaseQuantity(quantity: number, factor: number): number {
  return (Number(quantity) || 0) * (Number(factor) || 0);
}

export function computeConversionFactor(baseQuantity: number, quantity: number): number {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return (Number(baseQuantity) || 0) / qty;
}

export type LineUnitSyncInput = {
  quantity?: number;
  baseQuantity?: number;
  conversionFactor?: number;
  unitId?: string;
  baseUnitId?: string;
};

export type ItemUnitSyncLink = {
  unitId?: string;
  isBaseUnit?: boolean;
  isFactorFixed?: boolean | null;
  conversionFactor?: number | string | null;
  unit?: { id?: string };
};

export function unitLinkForItem(
  units: ItemUnitSyncLink[] | undefined,
  unitId?: string
): ItemUnitSyncLink | undefined {
  if (!units?.length) return undefined;
  if (unitId) {
    const hit = units.find((u) => (u.unit?.id ?? u.unitId) === unitId);
    if (hit) return hit;
  }
  return units.find((u) => u.isBaseUnit) ?? units[0];
}

export function isFactorFixedForLink(link: ItemUnitSyncLink | undefined): boolean {
  return link?.isFactorFixed !== false;
}

export function catalogFactorForLink(link: ItemUnitSyncLink | undefined): number {
  const n = link?.conversionFactor != null ? Number(link.conversionFactor) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function syncLineUnitFields(
  line: LineUnitSyncInput,
  units: ItemUnitSyncLink[] | undefined,
  patch: Partial<LineUnitSyncInput> = {}
): Required<Pick<LineUnitSyncInput, 'quantity' | 'baseQuantity' | 'conversionFactor' | 'baseUnitId'>> & {
  isFactorFixed: boolean;
} {
  const next = { ...line, ...patch };
  const selected = unitLinkForItem(units, next.unitId);
  const base = units?.find((u) => u.isBaseUnit) ?? selected;
  const isFactorFixed = isFactorFixedForLink(selected);
  const quantity = Number(next.quantity) > 0 ? Number(next.quantity) : 0;
  const catalogFactor = catalogFactorForLink(selected);
  const baseUnitId = base?.unit?.id ?? base?.unitId ?? next.baseUnitId ?? '';

  if (isFactorFixed) {
    return {
      quantity,
      conversionFactor: catalogFactor,
      baseQuantity: computeBaseQuantity(quantity, catalogFactor),
      baseUnitId,
      isFactorFixed,
    };
  }

  const typedBase = Number(next.baseQuantity);
  if (Number.isFinite(typedBase) && typedBase > 0 && quantity > 0 && patch.baseQuantity != null) {
    return {
      quantity,
      baseQuantity: typedBase,
      conversionFactor: computeConversionFactor(typedBase, quantity),
      baseUnitId,
      isFactorFixed,
    };
  }

  const factor =
    next.conversionFactor != null && Number(next.conversionFactor) > 0
      ? Number(next.conversionFactor)
      : catalogFactor;
  return {
    quantity,
    conversionFactor: factor,
    baseQuantity: computeBaseQuantity(quantity, factor),
    baseUnitId,
    isFactorFixed,
  };
}
