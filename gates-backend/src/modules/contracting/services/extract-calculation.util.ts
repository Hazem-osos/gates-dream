import { roundTo4 } from '../../../shared/utils/decimal-round';

export function calculateClientExtractAmounts(params: {
  grossAmount: number;
  advanceDeductionPercent: number;
  retentionPercent: number;
  vatRate: number;
  whtRate: number;
  maxAdvanceRecovery?: number;
}) {
  const gross = roundTo4(params.grossAmount);
  let advanceDeduction = roundTo4(gross * (params.advanceDeductionPercent / 100));
  if (params.maxAdvanceRecovery != null) {
    advanceDeduction = Math.min(advanceDeduction, roundTo4(params.maxAdvanceRecovery));
  }
  const retention = roundTo4(gross * (params.retentionPercent / 100));
  const vatBase = roundTo4(gross - advanceDeduction - retention);
  const vat = roundTo4(Math.max(0, vatBase) * params.vatRate);
  const wht = roundTo4(gross * params.whtRate);
  const net = roundTo4(gross - advanceDeduction - retention + vat - wht);

  return {
    grossAmount: gross,
    advanceDeductionAmount: advanceDeduction,
    retentionAmount: retention,
    vatAmount: vat,
    whtAmount: wht,
    netAmount: net,
  };
}

export function calculateSubcontractorExtractAmounts(params: {
  grossAmount: number;
  advanceRecoveryPercent: number;
  retentionPercent: number;
  whtRate: number;
  penaltyAmount?: number;
  materialDeductionAmount?: number;
  maxAdvanceRecovery?: number;
}) {
  const gross = roundTo4(params.grossAmount);
  let advanceDeduction = roundTo4(gross * (params.advanceRecoveryPercent / 100));
  if (params.maxAdvanceRecovery != null) {
    advanceDeduction = Math.min(advanceDeduction, roundTo4(params.maxAdvanceRecovery));
  }
  const retention = roundTo4(gross * (params.retentionPercent / 100));
  const penalty = roundTo4(params.penaltyAmount ?? 0);
  const material = roundTo4(params.materialDeductionAmount ?? 0);
  const wht = roundTo4(gross * params.whtRate);
  const net = roundTo4(
    gross - advanceDeduction - retention - penalty - material - wht
  );

  return {
    grossAmount: gross,
    advanceDeductionAmount: advanceDeduction,
    retentionAmount: retention,
    penaltyAmount: penalty,
    materialDeductionAmount: material,
    whtAmount: wht,
    netAmount: net,
  };
}
