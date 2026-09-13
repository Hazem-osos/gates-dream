import { toMoney } from './money';
import {
  HISTORICAL_INVOICE_STATUSES,
  type LiveInvoiceBreakdown,
  type LiveInvoiceLine,
  type SubcontractDetail,
} from './types';

const APPROACH_RATIO = 0.9;

export function calculateLiveDraft(
  subcontract: SubcontractDetail,
  currentQtyByBoq: Record<string, number>,
  options: { applyEarlyPaymentDiscount: boolean; excludeInvoiceId?: string }
): LiveInvoiceBreakdown {
  const historical = (subcontract.invoices ?? []).filter(
    (invoice) =>
      HISTORICAL_INVOICE_STATUSES.includes(invoice.status) &&
      invoice.id !== options.excludeInvoiceId
  );

  const previousQtyByBoq = new Map<string, number>();
  for (const invoice of historical) {
    for (const item of invoice.items ?? []) {
      previousQtyByBoq.set(
        item.subcontractBOQItemId,
        (previousQtyByBoq.get(item.subcontractBOQItemId) ?? 0) + toMoney(item.currentQuantity)
      );
    }
  }

  const previousGross = historical.reduce((sum, invoice) => sum + toMoney(invoice.grossCurrentAmount), 0);
  const previouslyRecoveredAdvance = historical.reduce(
    (sum, invoice) => sum + toMoney(invoice.advancePaymentDeduction),
    0
  );

  const lines: LiveInvoiceLine[] = (subcontract.boqItems ?? []).map((boq) => {
    const previousQuantity = previousQtyByBoq.get(boq.id) ?? 0;
    const currentQuantity = Math.max(0, toMoney(currentQtyByBoq[boq.id]));
    const contractQuantity = toMoney(boq.contractQuantity);
    const maxAllowedQuantity = toMoney(boq.maxAllowedQuantity);
    const unitPrice = toMoney(boq.unitPrice);
    const totalCumulativeQuantity = previousQuantity + currentQuantity;
    const completionPercentage = contractQuantity > 0 ? (totalCumulativeQuantity / contractQuantity) * 100 : 0;
    return {
      subcontractBOQItemId: boq.id,
      itemCode: boq.itemCode,
      descriptionAr: boq.descriptionAr,
      descriptionEn: boq.descriptionEn,
      unit: boq.unit,
      contractQuantity,
      maxAllowedQuantity,
      unitPrice,
      previousQuantity,
      currentQuantity,
      totalCumulativeQuantity,
      completionPercentage,
      totalCurrentAmount: currentQuantity * unitPrice,
      exceedsMax: totalCumulativeQuantity > maxAllowedQuantity + 1e-9,
      approachingMax: maxAllowedQuantity > 0 && totalCumulativeQuantity / maxAllowedQuantity >= APPROACH_RATIO,
    };
  });

  const grossCurrentAmount = lines.reduce((sum, line) => sum + line.totalCurrentAmount, 0);
  const remainingAdvanceBefore = Math.max(0, toMoney(subcontract.advancePaymentTotal) - previouslyRecoveredAdvance);
  const advanceCap = grossCurrentAmount * toMoney(subcontract.advancePaymentRecoveryRate);
  const advancePaymentDeduction =
    remainingAdvanceBefore > 0 && grossCurrentAmount > 0 ? Math.min(remainingAdvanceBefore, advanceCap) : 0;

  const retentionDeduction = grossCurrentAmount * toMoney(subcontract.retentionRate);
  const taxWithholdingDeduction = grossCurrentAmount * toMoney(subcontract.taxWithholdingRate);
  const socialInsuranceDeduction = grossCurrentAmount * toMoney(subcontract.socialInsuranceRate);

  const sitePenaltiesDeduction = (subcontract.sitePenalties ?? [])
    .filter(
      (row) =>
        (row.subcontractInvoiceId == null && row.status === 'APPROVED_FOR_DEDUCTION') ||
        row.subcontractInvoiceId === options.excludeInvoiceId
    )
    .reduce((sum, row) => sum + toMoney(row.amount), 0);

  const materialOveruseDeduction = (subcontract.materialReconciliations ?? [])
    .filter(
      (row) =>
        (row.subcontractInvoiceId == null && row.status === 'PENDING_DEDUCTION') ||
        row.subcontractInvoiceId === options.excludeInvoiceId
    )
    .reduce((sum, row) => sum + toMoney(row.totalPenaltyAmount), 0);

  const directExecutionDeduction = (subcontract.directExecutionCharges ?? [])
    .filter(
      (row) =>
        (row.subcontractInvoiceId == null && row.status === 'PENDING') ||
        row.subcontractInvoiceId === options.excludeInvoiceId
    )
    .reduce((sum, row) => sum + toMoney(row.totalDeduction), 0);

  const earlyPaymentDiscountDeduction = options.applyEarlyPaymentDiscount
    ? grossCurrentAmount * toMoney(subcontract.earlyPaymentDiscountRate)
    : 0;

  const netPayableAmount =
    grossCurrentAmount -
    advancePaymentDeduction -
    retentionDeduction -
    taxWithholdingDeduction -
    socialInsuranceDeduction -
    materialOveruseDeduction -
    sitePenaltiesDeduction -
    directExecutionDeduction -
    earlyPaymentDiscountDeduction;

  void previousGross;

  return {
    grossCurrentAmount,
    advancePaymentDeduction,
    retentionDeduction,
    taxWithholdingDeduction,
    socialInsuranceDeduction,
    materialOveruseDeduction,
    sitePenaltiesDeduction,
    directExecutionDeduction,
    earlyPaymentDiscountDeduction,
    netPayableAmount,
    remainingAdvanceAfter: Math.max(0, remainingAdvanceBefore - advancePaymentDeduction),
    lines,
  };
}

export function nextInvoiceSequence(subcontract: SubcontractDetail): number {
  const max = (subcontract.invoices ?? []).reduce((acc, invoice) => Math.max(acc, invoice.sequenceNumber ?? 0), 0);
  return max + 1;
}

export function dashboardMetrics(subcontract: SubcontractDetail) {
  const counted = (subcontract.invoices ?? []).filter(
    (invoice) => invoice.status !== 'DRAFT' && invoice.status !== 'REJECTED'
  );
  const totalInvoiced = counted.reduce((sum, invoice) => sum + toMoney(invoice.grossCurrentAmount), 0);
  const advanceRecovered = counted.reduce((sum, invoice) => sum + toMoney(invoice.advancePaymentDeduction), 0);
  const retentionHeld = counted.reduce((sum, invoice) => sum + toMoney(invoice.retentionDeduction), 0);
  const penaltiesDeducted = counted.reduce(
    (sum, invoice) =>
      sum +
      toMoney(invoice.sitePenaltiesDeduction) +
      toMoney(invoice.materialOveruseDeduction) +
      toMoney(invoice.directExecutionDeduction),
    0
  );
  const contractValue = toMoney(subcontract.totalContractValue);
  return {
    totalInvoiced,
    advanceRecovered,
    retentionHeld,
    penaltiesDeducted,
    remainingBalance: contractValue - totalInvoiced,
  };
}
