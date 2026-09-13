function roundTo4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export type ExtractLineDraft = {
  boqItemId: string;
  itemNumber: string;
  description: string;
  unit?: string;
  contractQuantity: number;
  unitPrice: number;
  previousQuantity: number;
  currentQuantity: number;
};

export type ExtractFinancialPreview = {
  currentExecutedAmount: number;
  previousExecutedAmount: number;
  totalExecutedAmount: number;
  advancePaymentDeduction: number;
  retentionDeduction: number;
  whtDeduction: number;
  penalties: number;
  otherDeductions: number;
  netBeforeVat: number;
  vatAmount: number;
  netPayableAmount: number;
  lines: Array<{
    boqItemId: string;
    cumulativeQuantity: number;
    lineTotal: number;
    progressPercent: number;
  }>;
};

export function computeExtractPreview(params: {
  lines: ExtractLineDraft[];
  previousExecutedAmount: number;
  advanceDeductionPercent: number;
  retentionPercent: number;
  vatRate: number;
  whtRate: number;
  penalties?: number;
  otherDeductions?: number;
  maxAdvanceRecovery?: number;
  extractType: 'CLIENT' | 'SUBCONTRACTOR';
}): ExtractFinancialPreview {
  const computedLines = params.lines.map((line) => {
    const prev = roundTo4(line.previousQuantity);
    const cur = roundTo4(line.currentQuantity);
    const cum = roundTo4(prev + cur);
    const price = roundTo4(line.unitPrice);
    const lineTotal = roundTo4(cur * price);
    const contractQty = roundTo4(line.contractQuantity || cum);
    const progressPercent =
      contractQty > 0 ? roundTo4((cum / contractQty) * 100) : 0;
    return {
      boqItemId: line.boqItemId,
      cumulativeQuantity: cum,
      lineTotal,
      progressPercent: Math.min(100, progressPercent),
    };
  });

  const current = roundTo4(computedLines.reduce((s, l) => s + l.lineTotal, 0));
  const previous = roundTo4(params.previousExecutedAmount);
  const total = roundTo4(previous + current);

  let advance = roundTo4(current * (params.advanceDeductionPercent / 100));
  if (params.maxAdvanceRecovery != null) {
    advance = Math.min(advance, roundTo4(params.maxAdvanceRecovery));
  }
  const retention = roundTo4(current * (params.retentionPercent / 100));
  const penalties = roundTo4(params.penalties ?? 0);
  const other = roundTo4(params.otherDeductions ?? 0);
  const wht = roundTo4(current * params.whtRate);
  const netBeforeVat = roundTo4(current - advance - retention - penalties - other);
  const vatAmount = roundTo4(Math.max(0, netBeforeVat) * params.vatRate);
  const netPayableAmount = roundTo4(netBeforeVat + vatAmount - wht);

  return {
    currentExecutedAmount: current,
    previousExecutedAmount: previous,
    totalExecutedAmount: total,
    advancePaymentDeduction: advance,
    retentionDeduction: retention,
    whtDeduction: wht,
    penalties,
    otherDeductions: other,
    netBeforeVat,
    vatAmount,
    netPayableAmount,
    lines: computedLines,
  };
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
