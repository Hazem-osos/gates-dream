import type { Prisma } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { money, moneyMaxZero, moneyZero, toDecimal } from '../../utils/money-decimal';
import { MeasurementSheetInvalidError } from '../errors/technical-office-domain.errors';
import type {
  CalculatedSheetQuantity,
  MeasurementSheetDimensions,
} from '../types/measurement-sheet.types';

type Db = Prisma.TransactionClient | typeof prisma;

export class ExecutiveMeasurementSheetService {
  calculateSheetNetQuantity(dimensions: MeasurementSheetDimensions): CalculatedSheetQuantity {
    const multiplierCount = money(dimensions.multiplierCount ?? 1);
    const deductionQty = money(dimensions.deductionQty ?? 0);
    const dimensionLength = optionalMoney(dimensions.dimensionLength);
    const dimensionWidth = optionalMoney(dimensions.dimensionWidth);
    const dimensionHeight = optionalMoney(dimensions.dimensionHeight);

    if (multiplierCount.lt(0)) {
      throw new MeasurementSheetInvalidError('multiplierCount cannot be negative', {
        multiplierCount: multiplierCount.toFixed(4),
      });
    }
    if (deductionQty.lt(0)) {
      throw new MeasurementSheetInvalidError('deductionQty cannot be negative', {
        deductionQty: deductionQty.toFixed(4),
      });
    }
    for (const [name, value] of [
      ['dimensionLength', dimensionLength],
      ['dimensionWidth', dimensionWidth],
      ['dimensionHeight', dimensionHeight],
    ] as const) {
      if (value && value.lte(0)) {
        throw new MeasurementSheetInvalidError(`${name} must be greater than zero when provided`, {
          [name]: value.toFixed(4),
        });
      }
    }

    const present = [dimensionLength, dimensionWidth, dimensionHeight].filter(
      (value): value is NonNullable<typeof value> => value != null
    );
    const dimensionCount = present.length as 0 | 1 | 2 | 3;

    let product = toDecimal(1);
    if (dimensionCount === 3 && dimensionLength && dimensionWidth && dimensionHeight) {
      product = dimensionLength.mul(dimensionWidth).mul(dimensionHeight);
    } else if (dimensionCount === 2) {
      product = present[0].mul(present[1]);
    } else if (dimensionCount === 1) {
      product = present[0];
    }

    const calculatedGrossQty = money(multiplierCount.mul(product));
    const netExecutedQty = moneyMaxZero(calculatedGrossQty.minus(deductionQty));

    return {
      multiplierCount,
      dimensionLength,
      dimensionWidth,
      dimensionHeight,
      deductionQty,
      calculatedGrossQty,
      netExecutedQty,
      dimensionCount,
    };
  }

  async getApprovedExecutedQuantityForBoq(
    companyId: string,
    projectBOQItemId: string,
    db: Db = prisma
  ) {
    const sheets = await db.executiveMeasurementSheet.findMany({
      where: {
        companyId,
        projectBOQItemId,
        status: 'CONSULTANT_APPROVED',
      },
      select: { netExecutedQty: true },
    });

    return {
      companyId,
      projectBOQItemId,
      sheetCount: sheets.length,
      approvedExecutedQty: sheets.length
        ? sheets.reduce((acc, row) => money(acc.plus(row.netExecutedQty)), moneyZero())
        : moneyZero(),
    };
  }
}

function optionalMoney(value: MeasurementSheetDimensions[keyof MeasurementSheetDimensions]) {
  if (value == null || value === '') return null;
  return money(value);
}

export const executiveMeasurementSheetService = new ExecutiveMeasurementSheetService();
