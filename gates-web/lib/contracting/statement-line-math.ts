/**
 * Preview amounts for extract / statement lines: quantity × unit price.
 * Server-calculated invoice totals remain authoritative after save.
 */
export function statementLineAmounts(input: {
  previousQty: number;
  currentQty: number;
  unitPrice: number;
}): {
  previousQty: number;
  currentQty: number;
  cumulativeQty: number;
  previousAmount: number;
  currentAmount: number;
  cumulativeAmount: number;
} {
  const previousQty = Math.max(0, Number.isFinite(input.previousQty) ? input.previousQty : 0);
  const currentQty = Math.max(0, Number.isFinite(input.currentQty) ? input.currentQty : 0);
  const unitPrice = Number.isFinite(input.unitPrice) ? input.unitPrice : 0;
  const cumulativeQty = previousQty + currentQty;
  return {
    previousQty,
    currentQty,
    cumulativeQty,
    previousAmount: previousQty * unitPrice,
    currentAmount: currentQty * unitPrice,
    cumulativeAmount: cumulativeQty * unitPrice,
  };
}

export function remainingStatementQty(contractQty: number, previousQty: number): number {
  return Math.max(0, (Number.isFinite(contractQty) ? contractQty : 0) - Math.max(0, previousQty));
}

/** Remaining after this period: contract − (previous + current). */
export function remainingAfterCurrent(
  contractQty: number,
  previousQty: number,
  currentQty: number
): number {
  return remainingStatementQty(
    contractQty,
    Math.max(0, previousQty) + Math.max(0, Number.isFinite(currentQty) ? currentQty : 0)
  );
}
