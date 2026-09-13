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

export function mapWithholdingTax(amount: number): EtaTaxLine {
  return {
    taxType: ETA_TAX_TABLE.WITHHOLDING.taxType,
    subType: ETA_TAX_TABLE.WITHHOLDING.subType,
    rate: 0,
    amount,
  };
}

export function mapTableTax(amount: number, rate = 0) {
  return {
    taxType: ETA_TAX_TABLE.TABLE.taxType,
    subType: ETA_TAX_TABLE.TABLE.subType,
    rate,
    amount,
  };
}
