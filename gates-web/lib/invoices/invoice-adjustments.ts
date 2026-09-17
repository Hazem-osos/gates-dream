import { parseDecimal, roundTo4 } from '../money/parseDecimal';

export type InvoiceAdjustmentKind = 'ADDITION' | 'DEDUCTION';
export type InvoiceAdjustmentCalc = 'FIXED' | 'PERCENTAGE';

export type InvoiceExtraRow = {
  key: string;
  accountId: string;
  discountValue: number | '';
  discountCalcType: InvoiceAdjustmentCalc;
  additionValue: number | '';
  additionCalcType: InvoiceAdjustmentCalc;
  currency: string;
  exchangeRate: number | '';
  description: string;
  costCenterId: string;
  offsetAccountId: string;
};

export type InvoiceAdjustmentApiRow = {
  id?: string;
  type: InvoiceAdjustmentKind;
  calcType: InvoiceAdjustmentCalc;
  rate?: number | string | null;
  amount: number | string;
  description?: string | null;
  currency?: string | null;
  exchangeRate?: number | string | null;
  accountId: string;
  offsetAccountId?: string | null;
  costCenterId?: string | null;
};

export function emptyInvoiceExtraRow(
  defaults?: Partial<Pick<InvoiceExtraRow, 'currency' | 'exchangeRate' | 'costCenterId'>>
): InvoiceExtraRow {
  return {
    key: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    accountId: '',
    discountValue: '',
    discountCalcType: 'FIXED',
    additionValue: '',
    additionCalcType: 'FIXED',
    currency: defaults?.currency ?? 'EGP',
    exchangeRate: defaults?.exchangeRate ?? 1,
    description: '',
    costCenterId: defaults?.costCenterId ?? '',
    offsetAccountId: '',
  };
}

function sideAmount(
  value: number | '',
  calcType: InvoiceAdjustmentCalc,
  baseSubtotal: number,
  rowExchangeRate: number | '',
  invoiceExchangeRate: number
): number {
  const entered = parseDecimal(value);
  if (entered <= 0) return 0;
  if (calcType === 'PERCENTAGE') {
    return roundTo4((Math.max(baseSubtotal, 0) * entered) / 100);
  }
  const rowFx = parseDecimal(rowExchangeRate) > 0 ? parseDecimal(rowExchangeRate) : 1;
  const invFx = invoiceExchangeRate > 0 ? invoiceExchangeRate : 1;
  return roundTo4(entered * (rowFx / invFx));
}

export function extraRowPartyImpact(
  row: InvoiceExtraRow,
  baseSubtotal: number,
  invoiceExchangeRate = 1
): number {
  if (String(row.offsetAccountId ?? '').trim()) return 0;
  const addition = sideAmount(
    row.additionValue,
    row.additionCalcType,
    baseSubtotal,
    row.exchangeRate,
    invoiceExchangeRate
  );
  const discount = sideAmount(
    row.discountValue,
    row.discountCalcType,
    baseSubtotal,
    row.exchangeRate,
    invoiceExchangeRate
  );
  return roundTo4(addition - discount);
}

export function sumPartyInvoiceExtras(
  rows: InvoiceExtraRow[],
  baseSubtotal: number,
  invoiceExchangeRate = 1
): number {
  return roundTo4(
    rows.reduce((sum, row) => sum + extraRowPartyImpact(row, baseSubtotal, invoiceExchangeRate), 0)
  );
}

export function extrasFromApi(rows: InvoiceAdjustmentApiRow[] | undefined): InvoiceExtraRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map((row) => {
    const calcType = row.calcType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED';
    const entered = calcType === 'PERCENTAGE' ? Number(row.rate ?? 0) : Number(row.amount ?? 0);
    return {
      key: row.id ?? emptyInvoiceExtraRow().key,
      accountId: row.accountId ?? '',
      discountValue: row.type === 'DEDUCTION' && entered > 0 ? entered : '',
      discountCalcType: calcType,
      additionValue: row.type === 'ADDITION' && entered > 0 ? entered : '',
      additionCalcType: calcType,
      currency: row.currency || 'EGP',
      exchangeRate: row.exchangeRate != null ? Number(row.exchangeRate) : 1,
      description: row.description ?? '',
      costCenterId: row.costCenterId ?? '',
      offsetAccountId: row.offsetAccountId ?? '',
    };
  });
}

export function extrasToApi(rows: InvoiceExtraRow[]): InvoiceAdjustmentApiRow[] {
  const payload: InvoiceAdjustmentApiRow[] = [];
  for (const row of rows) {
    if (!String(row.accountId ?? '').trim()) continue;
    const addition = parseDecimal(row.additionValue);
    const discount = parseDecimal(row.discountValue);
    if (addition > 0) {
      payload.push({
        type: 'ADDITION',
        calcType: row.additionCalcType,
        rate: row.additionCalcType === 'PERCENTAGE' ? addition : null,
        amount: row.additionCalcType === 'FIXED' ? addition : 0,
        description: String(row.description ?? '').trim() || null,
        currency: row.currency || 'EGP',
        exchangeRate: parseDecimal(row.exchangeRate) || 1,
        accountId: row.accountId,
        offsetAccountId: String(row.offsetAccountId ?? '').trim() || null,
        costCenterId: String(row.costCenterId ?? '').trim() || null,
      });
    }
    if (discount > 0) {
      payload.push({
        type: 'DEDUCTION',
        calcType: row.discountCalcType,
        rate: row.discountCalcType === 'PERCENTAGE' ? discount : null,
        amount: row.discountCalcType === 'FIXED' ? discount : 0,
        description: String(row.description ?? '').trim() || null,
        currency: row.currency || 'EGP',
        exchangeRate: parseDecimal(row.exchangeRate) || 1,
        accountId: row.accountId,
        offsetAccountId: String(row.offsetAccountId ?? '').trim() || null,
        costCenterId: String(row.costCenterId ?? '').trim() || null,
      });
    }
  }
  return payload;
}
