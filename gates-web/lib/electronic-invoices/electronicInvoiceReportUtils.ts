export type ElectronicInvoiceReportKind =
  | 'sales-invoices'
  | 'returns-invoices'
  | 'modified-returns';

export type ElectronicInvoiceApiRow = {
  id: string;
  invoiceNumber?: string | null;
  invoiceDate: string;
  status: string;
  submissionDate?: string | null;
  totalAmountAfterTax: number | string;
  branchId?: string | null;
  customer?: { arabicName?: string; taxNumber?: string };
};

export type ElectronicInvoiceTableRow = {
  id: string;
  index: number;
  patternName: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientCode: string;
  clientName: string;
  value: string;
  branch: string;
  currency: string;
  status: string;
  remainingDays: string;
  sent: string;
  submissionDate: string;
  sentBy: string;
};

export function formatElectronicInvoiceDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ar-EG');
}

export function isElectronicInvoiceSent(status: string): boolean {
  return status === 'submitted' || status === 'approved';
}

export function filterByInvoiceSelection(
  rows: ElectronicInvoiceApiRow[],
  selection: string
): ElectronicInvoiceApiRow[] {
  if (selection === 'sent') {
    return rows.filter((r) => isElectronicInvoiceSent(r.status));
  }
  if (selection === 'unsent') {
    return rows.filter((r) => !isElectronicInvoiceSent(r.status));
  }
  return rows;
}

export function mapElectronicInvoiceTableRow(
  inv: ElectronicInvoiceApiRow,
  index: number
): ElectronicInvoiceTableRow {
  const amount = Number(inv.totalAmountAfterTax ?? 0);
  return {
    id: inv.id,
    index: index + 1,
    patternName: '—',
    invoiceNumber: inv.invoiceNumber ?? '—',
    invoiceDate: formatElectronicInvoiceDate(inv.invoiceDate),
    clientCode: inv.customer?.taxNumber ?? '—',
    clientName: inv.customer?.arabicName ?? '—',
    value: amount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    branch: inv.branchId ? inv.branchId.slice(0, 8) : '—',
    currency: '—',
    status: inv.status,
    remainingDays: '—',
    sent: isElectronicInvoiceSent(inv.status) ? 'نعم' : 'لا',
    submissionDate: formatElectronicInvoiceDate(inv.submissionDate),
    sentBy: '—',
  };
}

export function buildElectronicInvoiceReportQueryParams(filterData: {
  clientCode: string;
  invoiceDateFrom: string;
  invoiceDateTo: string;
  invoiceNumber?: string;
  page: number;
}): Record<string, string | number | undefined> {
  return {
    customerId: filterData.clientCode.trim() || undefined,
    fromDate: filterData.invoiceDateFrom || undefined,
    toDate: filterData.invoiceDateTo || undefined,
    page: filterData.page,
    limit: 50,
  };
}
