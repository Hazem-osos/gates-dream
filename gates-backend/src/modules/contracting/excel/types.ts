import type { BOQItemUnit } from '@prisma/client';

export const EXCEL_MAX_BYTES = 15 * 1024 * 1024;
export const EXCEL_MAX_ROWS = 5000;
export const EXCEL_TEMPLATE_ROWS = 800;
export const BRAND_ARGB = 'FF0E79AA';

export type BoqExcelType = 'OWNER' | 'SUBCONTRACTOR';

export type BoqRowDto = {
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string | null;
  unit: BOQItemUnit;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
};

export type MeasurementRowDto = {
  itemCode: string;
  projectBOQItemId?: string;
  sheetNumber: string;
  locationZone?: string | null;
  axisGridRef?: string | null;
  statement?: string | null;
  multiplierCount: number;
  dimensionLength?: number | null;
  dimensionWidth?: number | null;
  dimensionHeight?: number | null;
  calculatedGrossQty: number;
  deductionQty: number;
  netExecutedQty: number;
  measurementDate?: string;
};

export type ValidatedExcelRow<T> = {
  rowNumber: number;
  data: T;
  isValid: boolean;
  errors: string[];
};

export type ExcelValidationReport<T> = {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: ValidatedExcelRow<T>[];
};

export type BoqCommitResult = {
  created: number;
  updated: number;
  total: number;
};

export type MeasurementCommitResult = {
  created: number;
  total: number;
};
