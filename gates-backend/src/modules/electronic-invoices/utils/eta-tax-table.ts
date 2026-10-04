import { roundTo4 } from '../../../shared/utils/decimal-round';

/** ETA e-invoice tax type / subtype codes (V1.0). */
export type EtaTaxTypeCode = 'T1' | 'T2' | 'T4';

export type EtaTaxLine = {
  taxType: string;
  subType: string;
  rate: number;
  amount: number;
};

export const ETA_TAX_TABLE = {
  /** Value Added Tax 14% — subtype V009 per ETA Egypt table. */
  VAT_14: { taxType: 'T1' as const, subType: 'V009', rate: 14 },
  /** Zero-rated / exempt VAT line. */
  VAT_ZERO: { taxType: 'T1' as const, subType: 'V002', rate: 0 },
  /** Withholding tax (أ.ت.ص). */
  WITHHOLDING: { taxType: 'T4' as const, subType: 'W001', rate: 0 },
  /** Table tax (ضريبة جدول) — rate resolved per item/category. */
  TABLE: { taxType: 'T2' as const, subType: 'Tbl01', rate: 0 },
} as const;

export function mapVatLineTax(vatPercent: number, taxAmount: number): EtaTaxLine {
  if (vatPercent <= 0 && taxAmount <= 0) {
    return { ...ETA_TAX_TABLE.VAT_ZERO, amount: 0, rate: 0 };
  }
  const rate = vatPercent > 0 ? vatPercent : ETA_TAX_TABLE.VAT_14.rate;
  return {
    taxType: ETA_TAX_TABLE.VAT_14.taxType,
    subType: ETA_TAX_TABLE.VAT_14.subType,
    rate,
    amount: taxAmount,
  };
}

export const ETA_WITHHOLDING_SUBTYPES = [
  { code: 'W001', label: 'W001 — توريدات / مشتريات' },
  { code: 'W002', label: 'W002 — خدمات' },
  { code: 'W003', label: 'W003 — مقاولات' },
  { code: 'W004', label: 'W004 — توريدات أخرى' },
  { code: 'W005', label: 'W005 — خدمات مهنية' },
  { code: 'W006', label: 'W006 — إيجارات' },
  { code: 'W007', label: 'W007 — عمولات' },
  { code: 'W008', label: 'W008 — توزيعات أرباح' },
  { code: 'W009', label: 'W009 — أتاوات' },
  { code: 'W010', label: 'W010 — أخرى' },
] as const;

export function mapWithholdingTax(amount: number, subType?: string): EtaTaxLine {
  const code = String(subType ?? '').trim() || ETA_TAX_TABLE.WITHHOLDING.subType;
  return {
    taxType: ETA_TAX_TABLE.WITHHOLDING.taxType,
    subType: code,
    rate: 0,
    amount,
  };
}

/** Rate ETA can recompute from the line net. A stored rate is kept when it already explains the amount. */
export function withholdingRateForAmount(amount: number, netTotal: number, storedRate = 0): number {
  if (!(netTotal > 0) || !(amount > 0)) return storedRate > 0 ? storedRate : 0;
  if (storedRate > 0 && Math.abs(roundTo4((netTotal * storedRate) / 100) - amount) <= 0.5) {
    return storedRate;
  }
  return roundTo4((amount / netTotal) * 100);
}

/** VAT plus T4 on the same line. ETA SF347 sums T4 from lines, not from the header alone. */
export function lineTaxableItems(input: {
  vatPercent: number;
  vatAmount: number;
  withholdingAmount: number;
  netTotal?: number;
  withholdingRate?: number;
  withholdingSubType?: string;
}): EtaTaxLine[] {
  const taxes: EtaTaxLine[] = [mapVatLineTax(input.vatPercent, input.vatAmount)];
  const withholding = roundTo4(input.withholdingAmount);
  if (withholding > 0) {
    const mapped = mapWithholdingTax(withholding, input.withholdingSubType);
    taxes.push({
      ...mapped,
      rate: withholdingRateForAmount(withholding, input.netTotal ?? 0, input.withholdingRate ?? 0),
      amount: withholding,
    });
  }
  return taxes;
}

/**
 * Commercial line discount (ETA `discount`), which reduces netTotal.
 * Distinct from `itemsDiscount`, which ETA subtracts only from the line total.
 * SF332: netTotal = salesTotal − discount.amount.
 * SF345: document totalDiscountAmount = Σ discount.amount.
 */
export function etaCommercialDiscount(
  salesTotal: number,
  discountAmount: number
): { rate: number; amount: number } | undefined {
  const amount = roundTo4(discountAmount);
  if (!(amount > 0) || !(salesTotal > 0)) return undefined;
  return { amount, rate: roundTo4((amount / salesTotal) * 100) };
}

/** ETA T16 / RD04 — fixed non-taxable resource development fee. Added to the line total, not to VAT. */
export const ETA_NONTAXABLE_DEVELOPMENT_FEE = { taxType: 'T16', subType: 'RD04', rate: 0 } as const;

export function etaNonTaxableDevelopmentFee(amount: number): EtaTaxLine | undefined {
  const value = roundTo4(amount);
  if (!(value > 0)) return undefined;
  return { ...ETA_NONTAXABLE_DEVELOPMENT_FEE, amount: value };
}

/** ETA T20 / OF04 — fixed non-taxable "other fees". Added to the line total, not to VAT. */
export const ETA_NONTAXABLE_OTHER_FEE = { taxType: 'T20', subType: 'OF04', rate: 0 } as const;

export function etaNonTaxableOtherFee(amount: number): EtaTaxLine | undefined {
  const value = roundTo4(amount);
  if (!(value > 0)) return undefined;
  return { ...ETA_NONTAXABLE_OTHER_FEE, amount: value };
}

/** Line total ETA checks: net + non-T4 taxes + non-taxable fees − T4. */
export function lineTotalForEta(
  netTotal: number,
  nonWithholdingTax: number,
  withholding: number,
  nonTaxableFees = 0
): number {
  return roundTo4(netTotal + nonWithholdingTax + nonTaxableFees - withholding);
}

/** Document total ETA checks (SF350): net + non-T4 taxes − T4 − extra discount. */
export function etaPayableTotal(
  netAmount: number,
  nonWithholdingTax: number,
  withholding: number,
  extraDiscount = 0
): number {
  return roundTo4(netAmount + nonWithholdingTax - withholding - extraDiscount);
}

/** Spread a header-only withholding amount across lines by net, last line takes the remainder. */
export function allocateHeaderWithholding(netTotals: number[], headerAmount: number): number[] {
  const header = roundTo4(headerAmount);
  if (!(header > 0) || netTotals.length === 0) return netTotals.map(() => 0);
  const weights = netTotals.map((net) => (net > 0 ? net : 0));
  const weightSum = weights.reduce((sum, net) => sum + net, 0);
  if (weightSum <= 0) return netTotals.map((_, index) => (index === 0 ? header : 0));
  let assigned = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return roundTo4(header - assigned);
    const share = roundTo4((header * weight) / weightSum);
    assigned = roundTo4(assigned + share);
    return share;
  });
}

export function mapTableTax(amount: number, rate = 0) {
  return {
    taxType: ETA_TAX_TABLE.TABLE.taxType,
    subType: ETA_TAX_TABLE.TABLE.subType,
    rate,
    amount,
  };
}
