export const ETA_PAYMENT_CODES = ['C', 'V', 'CC', 'VC', 'VO', 'PR', 'GC', 'P', 'O'] as const;

/** Gates tender -> ETA receipt payment method. Official table: https://sdk.invoicing.eta.gov.eg/codes/payment-methods/ */
const EXPLICIT: Record<string, string> = {
  CASH: 'C',
  CARD: 'V',
  VOUCHER: 'VO',
  GIFT_CARD: 'GC',
  POINTS: 'P',
  STORE_CREDIT: 'O',
  WALLET: 'O',
  BANK: 'O',
  CREDIT: 'O',
  EXCHANGE: 'O',
  DEPOSIT: 'O',
};

const BY_SETTLEMENT: Record<string, string> = {
  CASH: 'C',
  BANK: 'O',
  CREDIT: 'O',
  GIFT_CARD: 'GC',
  POINTS: 'P',
  STORE_CREDIT: 'O',
  DEPOSIT: 'O',
};

export type PaymentMapInput = {
  method: string;
  settlementType?: string | null;
  amount: number;
};

export function mapOnePayment(row: PaymentMapInput, overrides?: Record<string, string> | null): string | null {
  const method = row.method.trim().toUpperCase();
  const override = overrides?.[method] ?? overrides?.[row.method];
  if (override) return (ETA_PAYMENT_CODES as readonly string[]).includes(override) ? override : null;
  if (EXPLICIT[method]) return EXPLICIT[method];
  const settlement = String(row.settlementType ?? '').trim().toUpperCase();
  return BY_SETTLEMENT[settlement] ?? null;
}

/** One ETA paymentMethod. A split across different ETA codes is O. */
export function mapReceiptPaymentMethod(
  rows: PaymentMapInput[],
  overrides?: Record<string, string> | null
): { code: string | null; error: string | null } {
  const active = rows.filter((row) => row.amount > 0);
  if (active.length === 0) return { code: null, error: 'NO_PAYMENT' };
  const codes = active.map((row) => mapOnePayment(row, overrides));
  if (codes.some((code) => !code)) return { code: null, error: 'UNMAPPED_PAYMENT' };
  const unique = [...new Set(codes)];
  if (unique.length === 1) return { code: unique[0] ?? null, error: null };
  return { code: 'O', error: null };
}
