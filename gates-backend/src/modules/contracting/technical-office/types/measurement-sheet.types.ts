import type { Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type { DecimalInput } from '../../utils/money-decimal';

export interface MeasurementSheetDimensions {
  multiplierCount?: DecimalInput | null;
  dimensionLength?: DecimalInput | null;
  dimensionWidth?: DecimalInput | null;
  dimensionHeight?: DecimalInput | null;
  deductionQty?: DecimalInput | null;
}

export interface CalculatedSheetQuantity {
  multiplierCount: Decimal;
  dimensionLength: Decimal | null;
  dimensionWidth: Decimal | null;
  dimensionHeight: Decimal | null;
  deductionQty: Decimal;
  calculatedGrossQty: Decimal;
  netExecutedQty: Decimal;
  dimensionCount: 0 | 1 | 2 | 3;
}

export interface CreateMeasurementSheetDto extends MeasurementSheetDimensions {
  projectBOQItemId: string;
  sheetNumber: string;
  measurementDate: Date;
  locationZone?: string | null;
  axisGridRef?: string | null;
  statement?: string | null;
  attachments?: Prisma.InputJsonValue | null;
}
