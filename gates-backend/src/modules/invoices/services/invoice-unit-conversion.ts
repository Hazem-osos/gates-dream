import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import prisma from '../../../shared/database/prisma';
import { ensureDefaultPieceUnit } from '../../inventory/services/ensure-default-unit';

export const PRICING_CALCULATION_BASES = ['SELECTED_UNIT_QTY', 'BASE_UNIT_QTY'] as const;
export type PricingCalculationBasis = (typeof PRICING_CALCULATION_BASES)[number];

const FACTOR_TOLERANCE = 0.0001;

export function parsePricingCalculationBasis(value: unknown): PricingCalculationBasis {
  return value === 'BASE_UNIT_QTY' ? 'BASE_UNIT_QTY' : 'SELECTED_UNIT_QTY';
}

export function resolvePricedQuantity(
  quantity: number,
  baseQuantity: number,
  basis: PricingCalculationBasis
): number {
  return basis === 'BASE_UNIT_QTY' ? baseQuantity : quantity;
}

export type InvoiceLineUnitInput = {
  itemId: string;
  unitId?: string | null;
  quantity: number;
  baseQuantity?: number;
  conversionFactor?: number | null;
  baseUnitId?: string | null;
};

export type NormalizedInvoiceLineUnits = {
  unitId: string;
  quantity: number;
  baseQuantity: number;
  conversionFactor: number;
  baseUnitId: string;
  isFactorFixed: boolean;
};

export async function resolveCompanyPricingBasis(
  companyId: string,
  override?: string | null
): Promise<PricingCalculationBasis> {
  if (override === 'BASE_UNIT_QTY' || override === 'SELECTED_UNIT_QTY') {
    return override;
  }
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { pricingCalculationBasis: true },
  });
  return parsePricingCalculationBasis(settings?.pricingCalculationBasis);
}

export async function normalizeInvoiceLineUnits(
  companyId: string,
  line: InvoiceLineUnitInput
): Promise<NormalizedInvoiceLineUnits> {
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError(422, 'Line quantity must be greater than 0');
  }

  const item = await prisma.item.findFirst({
    where: { id: line.itemId, companyId },
    select: {
      id: true,
      units: {
        select: {
          unitId: true,
          isBaseUnit: true,
          isFactorFixed: true,
          conversionFactor: true,
        },
      },
    },
  });
  if (!item) {
    throw new AppError(422, 'Item not found for invoice line');
  }

  let units = item.units;
  if (!units.length) {
    const piece = await ensureDefaultPieceUnit(
      companyId,
      prisma as unknown as Prisma.TransactionClient
    );
    await prisma.itemUnit.create({
      data: {
        itemId: item.id,
        unitId: piece.id,
        conversionFactor: 1,
        isFactorFixed: true,
        isBaseUnit: true,
      },
    });
    units = [
      {
        unitId: piece.id,
        isBaseUnit: true,
        isFactorFixed: true,
        conversionFactor: new Prisma.Decimal(1),
      },
    ];
  }

  const requested = line.unitId?.trim();
  const selected =
    (requested ? units.find((u) => u.unitId === requested) : undefined) ??
    units.find((u) => u.isBaseUnit) ??
    units[0];
  if (!selected) {
    throw new AppError(422, 'Selected unit is not linked to this item');
  }

  const base = units.find((u) => u.isBaseUnit) ?? selected;
  const catalogFactor = Number(selected.conversionFactor ?? 1);
  const isFactorFixed = selected.isFactorFixed !== false;
  const clientFactor = line.conversionFactor != null ? Number(line.conversionFactor) : NaN;
  const clientBase = line.baseQuantity != null ? Number(line.baseQuantity) : NaN;

  let conversionFactor = catalogFactor;
  let baseQuantity = roundTo4(quantity * catalogFactor);

  if (isFactorFixed) {
    if (Number.isFinite(clientBase) && clientBase > 0) {
      if (Math.abs(clientBase - baseQuantity) > FACTOR_TOLERANCE) {
        throw new AppError(
          422,
          `baseQuantity (${clientBase}) must equal quantity × factor (${baseQuantity}) when the conversion factor is fixed`
        );
      }
      baseQuantity = roundTo4(clientBase);
    }
    conversionFactor = catalogFactor;
  } else {
    if (Number.isFinite(clientBase) && clientBase > 0) {
      baseQuantity = roundTo4(clientBase);
      conversionFactor = roundTo4(baseQuantity / quantity);
    } else if (Number.isFinite(clientFactor) && clientFactor > 0) {
      conversionFactor = roundTo4(clientFactor);
      baseQuantity = roundTo4(quantity * conversionFactor);
    } else {
      throw new AppError(422, 'Variable-factor lines require baseQuantity or conversionFactor');
    }
    if (conversionFactor <= 0 || baseQuantity <= 0) {
      throw new AppError(422, 'conversionFactor and baseQuantity must be greater than 0');
    }
  }

  return {
    unitId: selected.unitId,
    quantity,
    baseQuantity,
    conversionFactor,
    baseUnitId: line.baseUnitId?.trim() || base.unitId,
    isFactorFixed,
  };
}

export async function normalizeInvoiceLinesUnits(
  companyId: string,
  lines: InvoiceLineUnitInput[]
): Promise<NormalizedInvoiceLineUnits[]> {
  return Promise.all(lines.map((line) => normalizeInvoiceLineUnits(companyId, line)));
}
