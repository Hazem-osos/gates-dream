import { roundTo4 } from '../../../shared/utils/decimal-round';
import { AppError } from '../../../shared/middleware/error-handler';

export interface BoqLineInput {
  boqItemId: string;
  previousQuantity: number;
  currentQuantity: number;
  unitPrice: number;
  contractQuantity?: number;
}

export interface ComputedBoqLine {
  boqItemId: string;
  previousQuantity: number;
  currentQuantity: number;
  cumulativeQuantity: number;
  unitPrice: number;
  lineTotal: number;
  progressPercent: number;
}

export interface ExtractFinancialInput {
  currentExecutedAmount: number;
  previousExecutedAmount: number;
  advanceDeductionPercent: number;
  retentionPercent: number;
  vatRate: number;
  whtRate: number;
  penalties?: number;
  otherDeductions?: number;
  maxAdvanceRecovery?: number;
  extractType: 'CLIENT' | 'SUBCONTRACTOR';
}

/**
 * Line amount = round4(quantity × unitPrice).
 * Source of truth for statement lines and BOQ contract value of a leaf item.
 * Examples: 0.15 × 13,500 = 2,025; 22.5 × 13,500 = 303,750.
 */
export function quantityTimesPrice(quantity: number, unitPrice: number): number {
  return roundTo4(roundTo4(quantity) * roundTo4(unitPrice));
}

export function applyServerPreviousQuantities(
  lines: BoqLineInput[],
  previousByBoqId: Record<string, number>
): BoqLineInput[] {
  return lines.map((line) => ({
    ...line,
    previousQuantity: roundTo4(previousByBoqId[line.boqItemId] ?? 0),
  }));
}

export function assertBoqLineInputs(lines: BoqLineInput[]): void {
  if (!lines.length) {
    throw new AppError(422, 'Extract requires at least one BOQ line');
  }
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.boqItemId) {
      throw new AppError(400, 'Each extract line must reference a BOQ item');
    }
    if (seen.has(line.boqItemId)) {
      throw new AppError(400, `Duplicate BOQ item on extract: ${line.boqItemId}`);
    }
    seen.add(line.boqItemId);
    if (
      !Number.isFinite(line.currentQuantity) ||
      !Number.isFinite(line.previousQuantity) ||
      !Number.isFinite(line.unitPrice)
    ) {
      throw new AppError(400, 'Quantities and unit prices must be finite numbers');
    }
    if (line.currentQuantity < 0 || line.previousQuantity < 0 || line.unitPrice < 0) {
      throw new AppError(400, 'Quantities and unit prices cannot be negative');
    }
  }
}

export function computeBoqLines(lines: BoqLineInput[]): {
  lines: ComputedBoqLine[];
  currentExecutedAmount: number;
} {
  assertBoqLineInputs(lines);
  const computed = lines.map((line) => {
    const prev = roundTo4(line.previousQuantity);
    const cur = roundTo4(line.currentQuantity);
    const cum = roundTo4(prev + cur);
    const price = roundTo4(line.unitPrice);
    const lineTotal = quantityTimesPrice(cur, price);
    const contractQty = roundTo4(line.contractQuantity ?? cum);
    const progressPercent =
      contractQty > 0 ? roundTo4((cum / contractQty) * 100) : 0;
    return {
      boqItemId: line.boqItemId,
      previousQuantity: prev,
      currentQuantity: cur,
      cumulativeQuantity: cum,
      unitPrice: price,
      lineTotal,
      progressPercent: Math.min(100, progressPercent),
    };
  });

  const currentExecutedAmount = roundTo4(
    computed.reduce((s, l) => s + l.lineTotal, 0)
  );

  return { lines: computed, currentExecutedAmount };
}

export function computeExtractFinancials(input: ExtractFinancialInput) {
  const current = roundTo4(input.currentExecutedAmount);
  const previous = roundTo4(input.previousExecutedAmount);
  const total = roundTo4(previous + current);

  let advance = roundTo4(current * (input.advanceDeductionPercent / 100));
  if (input.maxAdvanceRecovery != null) {
    advance = Math.min(advance, roundTo4(input.maxAdvanceRecovery));
  }

  const retention = roundTo4(current * (input.retentionPercent / 100));
  const penalties = roundTo4(input.penalties ?? 0);
  const other = roundTo4(input.otherDeductions ?? 0);
  const wht = roundTo4(current * input.whtRate);

  const netBeforeVat = roundTo4(
    current - advance - retention - penalties - other
  );

  const vatBase = Math.max(0, netBeforeVat);
  const vatAmount =
    input.extractType === 'CLIENT'
      ? roundTo4(vatBase * input.vatRate)
      : roundTo4(vatBase * input.vatRate);

  let netPayableAmount: number;
  if (input.extractType === 'CLIENT') {
    netPayableAmount = roundTo4(netBeforeVat + vatAmount - wht);
  } else {
    netPayableAmount = roundTo4(netBeforeVat + vatAmount - wht);
  }

  return {
    totalExecutedAmount: total,
    previousExecutedAmount: previous,
    currentExecutedAmount: current,
    advancePaymentDeduction: advance,
    retentionDeduction: retention,
    whtDeduction: wht,
    otherDeductions: other,
    penalties,
    netBeforeVat,
    vatAmount,
    netPayableAmount,
  };
}
