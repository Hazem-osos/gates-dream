function finiteAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export type ExecutionPlanTender = {
  tenderQuantity: number;
  tenderRate: number;
  tenderTotal: number;
};

export type ExecutionPlanDistribution = {
  allocatedQuantity: number;
  distributionCost: number;
  overrunPercent: number;
};

export type ExecutionPlanAnalysisLine = {
  analysisQuantity: number;
  analysisRate: number;
  costPerUnit: number;
  analysisTotalQuantity: number;
  analysisTotalCost: number;
  distributionQuantity: number;
  distributionCost: number;
  overrunPercent: number;
};

/** Tender qty × tender unit rate. Display only. */
export function executionPlanTenderTotals(input: {
  contractQuantity: number;
  unitSellingPrice: number;
}): ExecutionPlanTender {
  const tenderQuantity = finiteAmount(input.contractQuantity);
  const tenderRate = finiteNumber(input.unitSellingPrice);
  return {
    tenderQuantity,
    tenderRate,
    tenderTotal: tenderQuantity * tenderRate,
  };
}

/**
 * Distribution vs tender. Overrun is only shown when allocated exceeds the
 * contract quantity — the server still rejects that on save.
 */
export function executionPlanDistribution(input: {
  allocatedQuantity: number;
  plannedUnitCost: number | null | undefined;
  contractQuantity: number;
}): ExecutionPlanDistribution {
  const allocatedQuantity = finiteAmount(input.allocatedQuantity);
  const contractQuantity = finiteAmount(input.contractQuantity);
  const unitCost = input.plannedUnitCost == null ? 0 : finiteNumber(input.plannedUnitCost);
  const overrunPercent =
    contractQuantity > 0 && allocatedQuantity > contractQuantity
      ? ((allocatedQuantity - contractQuantity) / contractQuantity) * 100
      : 0;
  return {
    allocatedQuantity,
    distributionCost: allocatedQuantity * unitCost,
    overrunPercent,
  };
}

/**
 * Double Click analysis child row:
 * إجمالي الكمية تحليل = المعدل × كمية العطاء
 * إجمالي التكلفة تحليل = تكلفة الوحدة × كمية العطاء
 * كمية/تكلفة التوزيع تحليل = نفس الحساب على الكمية الموزعة
 */
export function executionPlanAnalysisLine(input: {
  consumptionQuotaPerUnit: number;
  unitCost: number;
  totalCostPerUnit: number;
  contractQuantity: number;
  allocatedQuantity: number;
}): ExecutionPlanAnalysisLine {
  const analysisQuantity = finiteAmount(input.consumptionQuotaPerUnit);
  const analysisRate = finiteNumber(input.unitCost);
  const costPerUnit = finiteNumber(input.totalCostPerUnit);
  const contractQuantity = finiteAmount(input.contractQuantity);
  const allocatedQuantity = finiteAmount(input.allocatedQuantity);
  const analysisTotalQuantity = analysisQuantity * contractQuantity;
  const analysisTotalCost = costPerUnit * contractQuantity;
  const distributionQuantity = analysisQuantity * allocatedQuantity;
  const distributionCost = costPerUnit * allocatedQuantity;
  const overrunPercent =
    analysisTotalQuantity > 0 && distributionQuantity > analysisTotalQuantity
      ? ((distributionQuantity - analysisTotalQuantity) / analysisTotalQuantity) * 100
      : 0;
  return {
    analysisQuantity,
    analysisRate,
    costPerUnit,
    analysisTotalQuantity,
    analysisTotalCost,
    distributionQuantity,
    distributionCost,
    overrunPercent,
  };
}
