import type { BOQCostElementType, ProjectBOQItemStatus } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type { DecimalInput } from '../../utils/money-decimal';

export interface RateAnalysisElementInput {
  costElementType: BOQCostElementType;
  consumptionQuotaPerUnit: DecimalInput;
  wasteFactorRate?: DecimalInput | null;
  unitCost: DecimalInput;
  resourceCode?: string | null;
  descriptionAr?: string | null;
}

export interface CalculatedRateAnalysisElement {
  costElementType: BOQCostElementType;
  resourceCode: string | null;
  descriptionAr: string | null;
  consumptionQuotaPerUnit: Decimal;
  wasteFactorRate: Decimal;
  unitCost: Decimal;
  elementCost: Decimal;
}

export interface DirectUnitCostResult {
  boqItemId: string;
  elements: CalculatedRateAnalysisElement[];
  byElementType: Record<BOQCostElementType, Decimal>;
  totalDirectCost: Decimal;
}

export interface MarkupRates {
  generalOverheadRate: Decimal;
  siteOverheadRate: Decimal;
  contingencyRiskRate: Decimal;
  profitMarginRate: Decimal;
  contractTaxesRate: Decimal;
  source: 'ITEM' | 'PROJECT' | 'DEFAULT';
}

export interface BoqItemSellingPriceResult {
  boqItemId: string;
  companyId: string;
  directCostEstimated: Decimal;
  overheadMultiplier: Decimal;
  costWithOverhead: Decimal;
  unitSellingPrice: Decimal;
  totalSellingPrice: Decimal;
  contractQuantity: Decimal;
  compositeMarkupRate: Decimal;
  status: ProjectBOQItemStatus;
  markup: MarkupRates;
  direct: DirectUnitCostResult;
}

export interface PersistRateAnalysisElementInput extends RateAnalysisElementInput {
  unit: string;
  descriptionEn?: string | null;
  notes?: string | null;
}

export interface UpsertRateAnalysisDto {
  items: PersistRateAnalysisElementInput[];
}

export interface SetMarkupDto {
  generalOverheadRate: DecimalInput;
  siteOverheadRate: DecimalInput;
  contingencyRiskRate: DecimalInput;
  profitMarginRate: DecimalInput;
  contractTaxesRate: DecimalInput;
  applyAtProjectLevel?: boolean;
}
