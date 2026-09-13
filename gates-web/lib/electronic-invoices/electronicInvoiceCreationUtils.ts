import { formatElectronicInvoiceDate } from '@/lib/electronic-invoices/electronicInvoiceReportUtils';
import { formatMoneyAr } from '@/lib/formatMoney';

export type ElectronicInvoiceListRow = {
  id: string;
  invoiceNumber?: string | null;
  invoiceDate: string;
  invoiceType: string;
  status: string;
  totalAmount?: number | string;
  totalTax?: number | string;
  totalAmountAfterTax?: number | string;
  customer?: { arabicName?: string | null };
};

export type ElectronicInvoiceCreationQuery = {
  invoiceType?: 'sales' | 'return' | 'amendment';
  status?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
};

export function buildElectronicInvoiceCreationQueryParams(
  q: ElectronicInvoiceCreationQuery
): Record<string, string | number | undefined> {
  return {
    invoiceType: q.invoiceType,
    status: q.status,
    customerId: q.customerId,
    fromDate: q.fromDate,
    toDate: q.toDate,
    page: q.page ?? 1,
    limit: q.limit ?? 50,
  };
}

/** Rows for {@link AccountingTable} (columns: net, tax, value, date, delegate, client, invoice#). */
export function mapElectronicInvoiceToAccountingTableRows(
  invoices: ElectronicInvoiceListRow[]
): (string | number)[][] {
  return invoices.map((inv) => {
    const net = Number(inv.totalAmount ?? 0);
    const tax = Number(inv.totalTax ?? 0);
    const gross = Number(inv.totalAmountAfterTax ?? net + tax);
    return [
      formatMoneyAr(net),
      formatMoneyAr(tax),
      formatMoneyAr(gross),
      formatElectronicInvoiceDate(inv.invoiceDate),
      '—',
      inv.customer?.arabicName ?? '—',
      inv.invoiceNumber ?? '—',
    ];
  });
}

export function sumElectronicInvoiceTotals(invoices: ElectronicInvoiceListRow[]): number {
  return invoices.reduce(
    (sum, inv) => sum + Number(inv.totalAmountAfterTax ?? inv.totalAmount ?? 0),
    0
  );
}
