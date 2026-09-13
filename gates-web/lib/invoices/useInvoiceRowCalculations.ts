'use client';

import { useMemo } from 'react';
import { calculateRowTotals, type InvoiceRowCalcLine, type InvoiceRowTotals } from './calculateInvoiceRowTotals';
import { computeInvoiceFinancialSummary } from './computeInvoiceFinancialSummary';
import type { PricingCalculationBasis } from './unit-conversion';

export function useInvoiceRowCalculations<T extends InvoiceRowCalcLine>(
  lines: T[] | undefined,
  opts?: {
    applyTax?: boolean;
    pricingCalculationBasis?: PricingCalculationBasis | string;
    withholdingTaxAmount?: number;
    developmentFeeEnabled?: boolean;
    developmentFeeMode?: 'percent' | 'fixed';
    developmentFeeRate?: number | null;
    developmentFeeFixedAmount?: number | null;
  }
) {
  return useMemo(() => {
    const rows: InvoiceRowTotals[] = (lines ?? []).map((line) =>
      calculateRowTotals(line, { pricingCalculationBasis: opts?.pricingCalculationBasis })
    );
    const summary = computeInvoiceFinancialSummary(lines ?? [], opts);
    return { rows, summary };
  // Primitive fields listed so inline `opts` objects do not recompute every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- opts identity is unstable
  }, [
    lines,
    opts?.applyTax,
    opts?.pricingCalculationBasis,
    opts?.withholdingTaxAmount,
    opts?.developmentFeeEnabled,
    opts?.developmentFeeMode,
    opts?.developmentFeeRate,
    opts?.developmentFeeFixedAmount,
  ]);
}
