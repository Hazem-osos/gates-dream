import { asFxRate } from '../../accounting/utils/company-fx-rate';
import { splitVoucherLineTotals } from '../types/vouchers.dto';

type CashFundLine = {
  amount?: unknown;
  exchangeRate?: unknown;
  entrySide?: string | null;
};

type CashFundRow = {
  amount?: unknown;
  exchangeRate?: unknown;
  transactionKind?: string;
  lines?: CashFundLine[];
};

/**
 * Same base (EGP) amount `buildReceiptLines` / `buildPaymentLines` apply
 * to the safe on post. Unpost/rewrite must reverse this, not `row.amount`
 * (which may still be the foreign document total).
 */
export function postedCashFundAmount(row: CashFundRow): number {
  const kind = row.transactionKind === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT';
  const headerRate = asFxRate(row.exchangeRate, 1);
  const lines = row.lines ?? [];
  if (lines.length > 0) {
    const { netCash } = splitVoucherLineTotals(
      lines.map((line) => ({
        amount: Number(line.amount),
        exchangeRate: line.exchangeRate != null ? Number(line.exchangeRate) : headerRate,
        entrySide: line.entrySide ?? undefined,
      })),
      kind
    );
    if (netCash > 0) return netCash;
  }
  return Number(row.amount || 0) * headerRate;
}
