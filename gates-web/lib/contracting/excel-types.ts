export type BoqExcelType = 'OWNER' | 'SUBCONTRACTOR';

export type ExcelImportMode = 'OWNER_BOQ' | 'SUBCONTRACT_BOQ' | 'MEASUREMENTS';

export type BoqImportRow = {
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string | null;
  unit: 'M2' | 'M3' | 'TON' | 'ITEM' | 'LM' | 'LS';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
};

export type MeasurementImportRow = {
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

export type ExcelValidatedRow<T> = {
  rowNumber: number;
  data: T;
  isValid: boolean;
  errors: string[];
};

export type ExcelValidationReport<T> = {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: ExcelValidatedRow<T>[];
};

export type BoqCommitResult = { created: number; updated: number; total: number };
export type MeasurementCommitResult = { created: number; total: number };
