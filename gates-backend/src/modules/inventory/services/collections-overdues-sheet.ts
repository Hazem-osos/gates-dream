import { roundTo4 } from '../../../shared/utils/decimal-round';

const AMOUNT_EPSILON = 0.00005;

export type CollectionOverdueParty = {
  id: string;
  code: string | null;
  arabicName: string;
};

export type CollectionOverdueInstallment = {
  dueDate: Date;
  amount: number;
  paidAmount: number;
  isPaid: boolean;
};

export type CollectionOverdueInvoice = {
  customerId: string;
  date: Date;
  dueDate: Date | null;
  netAmount: number;
  remainingAmount: number;
  installments?: CollectionOverdueInstallment[];
};

export type CollectionOverdueCash = {
  customerId: string;
  date: Date;
  amount: number;
  allocatedAmount: number;
};

export type CollectionOverdueRow = {
  customerCode: string;
  customer: { id: string; code: string | null; arabicName: string };
  invoiceCount: number;
  totalSales: number;
  totalCollections: number;
  currentDue: number;
  overdueAmount: number;
  balance: number;
  lastInvoiceDate: string | null;
  lastCollectionDate: string | null;
  oldestDueDate: string | null;
  daysOverdue: number;
};

function isoDay(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${value.getUTCFullYear()}-${month}-${day}`;
}

function onOrBefore(date: Date, asOf: Date) {
  return date.getTime() <= asOf.getTime();
}

function hasAmount(value: number) {
  return Math.abs(value) >= AMOUNT_EPSILON;
}

/** Allocations settle the invoice. A receipt linked with no allocation rows is the legacy full settlement. */
export function appliedCollectionAmount(amount: number, allocatedAmount: number, linkedToInvoice: boolean) {
  if (allocatedAmount > AMOUNT_EPSILON) return Math.min(allocatedAmount, amount);
  if (linkedToInvoice) return amount;
  return 0;
}

function dueOf(invoice: CollectionOverdueInvoice) {
  return invoice.dueDate ?? invoice.date;
}

function noteOpenDue(
  row: { currentDue: number; overdueAmount: number; oldestDueDate: Date | null },
  dueDate: Date,
  amount: number,
  asOf: Date
) {
  if (dueDate.getTime() < asOf.getTime()) row.overdueAmount += amount;
  else row.currentDue += amount;
  if (!row.oldestDueDate || dueDate.getTime() < row.oldestDueDate.getTime()) {
    row.oldestDueDate = dueDate;
  }
}

/**
 * One row per customer as of one date.
 * المستحق: open balance whose due date has not arrived.
 * المتأخر: open balance whose due date has arrived and is still unpaid.
 * التحصيلات: every posted receipt and inward cheque, whether or not it was allocated.
 * Applied collections already sit inside remainingAmount. Only the leftover
 * is netted against المتأخر then المستحق, and against the balance.
 */
export function buildCollectionsOverdueRows(input: {
  customers: CollectionOverdueParty[];
  invoices: CollectionOverdueInvoice[];
  cash: CollectionOverdueCash[];
  asOf: Date;
  allAccounts: boolean;
}): CollectionOverdueRow[] {
  const byId = new Map<
    string,
    {
      invoiceCount: number;
      totalSales: number;
      totalCollections: number;
      currentDue: number;
      overdueAmount: number;
      balance: number;
      lastInvoiceDate: Date | null;
      lastCollectionDate: Date | null;
      oldestDueDate: Date | null;
      unappliedCredit: number;
    }
  >();
  const ensure = (customerId: string) => {
    const current = byId.get(customerId);
    if (current) return current;
    const created = {
      invoiceCount: 0,
      totalSales: 0,
      totalCollections: 0,
      currentDue: 0,
      overdueAmount: 0,
      balance: 0,
      lastInvoiceDate: null as Date | null,
      lastCollectionDate: null as Date | null,
      oldestDueDate: null as Date | null,
      unappliedCredit: 0,
    };
    byId.set(customerId, created);
    return created;
  };

  for (const invoice of input.invoices) {
    if (!onOrBefore(invoice.date, input.asOf)) continue;
    const row = ensure(invoice.customerId);
    const remaining = invoice.remainingAmount;
    row.invoiceCount += 1;
    row.totalSales += invoice.netAmount;
    row.balance += remaining;
    const openInstallments = (invoice.installments || []).filter(
      (installment) =>
        !installment.isPaid && installment.amount - installment.paidAmount > AMOUNT_EPSILON
    );
    if (remaining > AMOUNT_EPSILON && openInstallments.length) {
      for (const installment of openInstallments) {
        const part = installment.amount - installment.paidAmount;
        noteOpenDue(row, installment.dueDate, part, input.asOf);
      }
    } else if (remaining > AMOUNT_EPSILON) {
      noteOpenDue(row, dueOf(invoice), remaining, input.asOf);
    }
    if (!row.lastInvoiceDate || invoice.date.getTime() > row.lastInvoiceDate.getTime()) {
      row.lastInvoiceDate = invoice.date;
    }
  }

  for (const movement of input.cash) {
    if (!onOrBefore(movement.date, input.asOf)) continue;
    const row = ensure(movement.customerId);
    const unapplied = Math.max(movement.amount - movement.allocatedAmount, 0);
    row.totalCollections += movement.amount;
    row.unappliedCredit += unapplied;
    row.balance -= unapplied;
    if (!row.lastCollectionDate || movement.date.getTime() > row.lastCollectionDate.getTime()) {
      row.lastCollectionDate = movement.date;
    }
  }

  const rows: CollectionOverdueRow[] = [];
  for (const customer of input.customers) {
    const totals = byId.get(customer.id);
    if (!totals) {
      if (!input.allAccounts) continue;
      rows.push({
        customerCode: customer.code || '',
        customer: { id: customer.id, code: customer.code, arabicName: customer.arabicName },
        invoiceCount: 0,
        totalSales: 0,
        totalCollections: 0,
        currentDue: 0,
        overdueAmount: 0,
        balance: 0,
        lastInvoiceDate: null,
        lastCollectionDate: null,
        oldestDueDate: null,
        daysOverdue: 0,
      });
      continue;
    }

    let credit = totals.unappliedCredit;
    if (credit > AMOUNT_EPSILON && totals.overdueAmount > AMOUNT_EPSILON) {
      const take = Math.min(totals.overdueAmount, credit);
      totals.overdueAmount -= take;
      credit -= take;
    }
    if (credit > AMOUNT_EPSILON && totals.currentDue > AMOUNT_EPSILON) {
      totals.currentDue -= Math.min(totals.currentDue, credit);
    }

    const totalSales = roundTo4(totals.totalSales);
    const totalCollections = roundTo4(totals.totalCollections);
    const currentDue = roundTo4(totals.currentDue);
    const overdueAmount = roundTo4(totals.overdueAmount);
    const balance = roundTo4(totals.balance);
    const active =
      totals.invoiceCount > 0 ||
      hasAmount(totalSales) ||
      hasAmount(totalCollections) ||
      hasAmount(balance);
    if (!input.allAccounts && !active) continue;

    const oldestOpenDue =
      overdueAmount > AMOUNT_EPSILON || currentDue > AMOUNT_EPSILON ? totals.oldestDueDate : null;
    const daysOverdue =
      overdueAmount > AMOUNT_EPSILON && oldestOpenDue
        ? Math.max(
            0,
            Math.floor((input.asOf.getTime() - oldestOpenDue.getTime()) / 86_400_000)
          )
        : 0;

    rows.push({
      customerCode: customer.code || '',
      customer: { id: customer.id, code: customer.code, arabicName: customer.arabicName },
      invoiceCount: totals.invoiceCount,
      totalSales,
      totalCollections,
      currentDue,
      overdueAmount,
      balance,
      lastInvoiceDate: isoDay(totals.lastInvoiceDate),
      lastCollectionDate: isoDay(totals.lastCollectionDate),
      oldestDueDate: isoDay(oldestOpenDue),
      daysOverdue,
    });
  }

  rows.sort((a, b) => {
    if (b.overdueAmount !== a.overdueAmount) return b.overdueAmount - a.overdueAmount;
    if (b.balance !== a.balance) return b.balance - a.balance;
    return a.customer.arabicName.localeCompare(b.customer.arabicName, 'ar');
  });
  return rows;
}
