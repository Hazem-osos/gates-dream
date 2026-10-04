import { roundTo4 } from '../../../shared/utils/decimal-round';

const BALANCE_EPSILON = 0.00005;

export type CustomerBalanceParty = {
  id: string;
  code: string | null;
  arabicName: string;
  accountCode?: string | null;
  parentAccountCode?: string | null;
  parentAccountName?: string | null;
  budget?: number;
};

export type CustomerBalanceInvoice = {
  customerId: string;
  kind: 'SALE' | 'SALE_RETURN';
  date: Date;
  netAmount: number;
};

export type CustomerBalanceCash = {
  customerId: string;
  kind: 'RECEIPT' | 'PAYMENT';
  date: Date;
  amount: number;
};

export type CustomerBalanceRow = {
  accountLabel: string;
  previousBalance: number;
  debit: number;
  credit: number;
  currentBalance: number;
  budget: number;
  budgetRemaining: number;
  isGroup?: boolean;
  customer?: { id: string; code: string | null; arabicName: string };
};

type Movement = { debit: number; credit: number };

function onOrBefore(date: Date, toDate: Date) {
  return date.getTime() <= toDate.getTime();
}

function hasAmount(value: number) {
  return Math.abs(value) >= BALANCE_EPSILON;
}

function accountLabel(code: string | null | undefined, name: string) {
  const trimmed = (code || '').trim();
  return trimmed ? `${trimmed}-${name}` : name;
}

function compareCodes(a: string, b: string) {
  return a.localeCompare(b, 'en', { numeric: true });
}

function addMovement(bucket: Movement, kind: 'SALE' | 'SALE_RETURN' | 'RECEIPT' | 'PAYMENT', amount: number) {
  const value = Number(amount) || 0;
  if (kind === 'SALE' || kind === 'PAYMENT') bucket.debit += value;
  else bucket.credit += value;
}

function sumRows(rows: CustomerBalanceRow[]) {
  const totals = rows.reduce(
    (sum, row) => ({
      previousBalance: sum.previousBalance + row.previousBalance,
      debit: sum.debit + row.debit,
      credit: sum.credit + row.credit,
      currentBalance: sum.currentBalance + row.currentBalance,
      budget: sum.budget + row.budget,
      budgetRemaining: sum.budgetRemaining + row.budgetRemaining,
    }),
    { previousBalance: 0, debit: 0, credit: 0, currentBalance: 0, budget: 0, budgetRemaining: 0 }
  );
  return {
    previousBalance: roundTo4(totals.previousBalance),
    debit: roundTo4(totals.debit),
    credit: roundTo4(totals.credit),
    currentBalance: roundTo4(totals.currentBalance),
    budget: roundTo4(totals.budget),
    budgetRemaining: roundTo4(totals.budgetRemaining),
  };
}

/**
 * Customer balances as an account movement sheet.
 * Sales and customer payments are debit. Returns and receipts are credit.
 * Opening is everything before fromDate. Current = previous + debit − credit.
 * A parent account row, when customers share one, is the sum of its children.
 */
export function buildCustomerBalanceRows(input: {
  customers: CustomerBalanceParty[];
  invoices: CustomerBalanceInvoice[];
  cash: CustomerBalanceCash[];
  fromDate?: Date;
  toDate: Date;
  allAccounts: boolean;
}): CustomerBalanceRow[] {
  const byId = new Map<string, { prior: Movement; period: Movement }>();
  const ensure = (customerId: string) => {
    const current = byId.get(customerId);
    if (current) return current;
    const created = { prior: { debit: 0, credit: 0 }, period: { debit: 0, credit: 0 } };
    byId.set(customerId, created);
    return created;
  };
  const bucketFor = (customerId: string, date: Date) => {
    const row = ensure(customerId);
    if (input.fromDate && date.getTime() < input.fromDate.getTime()) return row.prior;
    return row.period;
  };

  for (const invoice of input.invoices) {
    if (!onOrBefore(invoice.date, input.toDate)) continue;
    addMovement(bucketFor(invoice.customerId, invoice.date), invoice.kind, invoice.netAmount);
  }
  for (const movement of input.cash) {
    if (!onOrBefore(movement.date, input.toDate)) continue;
    addMovement(bucketFor(movement.customerId, movement.date), movement.kind, movement.amount);
  }

  const detail: Array<CustomerBalanceRow & { sortCode: string; parentCode: string; parentName: string }> = [];
  for (const customer of input.customers) {
    const totals = byId.get(customer.id) ?? {
      prior: { debit: 0, credit: 0 },
      period: { debit: 0, credit: 0 },
    };
    const previousBalance = roundTo4(totals.prior.debit - totals.prior.credit);
    const debit = roundTo4(totals.period.debit);
    const credit = roundTo4(totals.period.credit);
    const currentBalance = roundTo4(previousBalance + debit - credit);
    const budget = roundTo4(Number(customer.budget) || 0);
    const budgetRemaining = roundTo4(currentBalance - budget);
    const active =
      hasAmount(previousBalance) || hasAmount(debit) || hasAmount(credit) || hasAmount(currentBalance);
    if (!input.allAccounts && !active) continue;
    const code = customer.accountCode || customer.code;
    detail.push({
      accountLabel: accountLabel(code, customer.arabicName),
      previousBalance,
      debit,
      credit,
      currentBalance,
      budget,
      budgetRemaining,
      customer: { id: customer.id, code: customer.code, arabicName: customer.arabicName },
      sortCode: (code || '').trim(),
      parentCode: (customer.parentAccountCode || '').trim(),
      parentName: (customer.parentAccountName || '').trim(),
    });
  }

  detail.sort((a, b) => compareCodes(a.sortCode, b.sortCode) || a.accountLabel.localeCompare(b.accountLabel, 'ar'));

  const groups = new Map<string, { code: string; name: string; rows: CustomerBalanceRow[] }>();
  const loose: CustomerBalanceRow[] = [];
  for (const row of detail) {
    const { sortCode: _sortCode, parentCode, parentName, ...customerRow } = row;
    if (!parentCode) {
      loose.push(customerRow);
      continue;
    }
    const group = groups.get(parentCode) ?? { code: parentCode, name: parentName, rows: [] };
    if (!group.name && parentName) group.name = parentName;
    group.rows.push(customerRow);
    groups.set(parentCode, group);
  }

  const ordered: CustomerBalanceRow[] = [];
  const parents = [...groups.values()].sort((a, b) => compareCodes(a.code, b.code));
  for (const parent of parents) {
    ordered.push({
      accountLabel: accountLabel(parent.code, parent.name || 'العملاء'),
      ...sumRows(parent.rows),
      isGroup: true,
    });
    ordered.push(...parent.rows);
  }
  ordered.push(...loose);
  return ordered;
}
