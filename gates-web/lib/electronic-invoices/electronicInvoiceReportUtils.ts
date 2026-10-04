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
  branchName?: string | null;
  currency?: string | null;
  patternName?: string | null;
  remainingDays?: string | null;
  documentUuid?: string | null;
  statusLabel?: string | null;
  customer?: { arabicName?: string; taxNumber?: string; code?: string };
  sentBy?: string | null;
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
    patternName: inv.patternName || '—',
    invoiceNumber: inv.invoiceNumber ?? '—',
    invoiceDate: formatElectronicInvoiceDate(inv.invoiceDate),
    clientCode: inv.customer?.code || inv.customer?.taxNumber || '—',
    clientName: inv.customer?.arabicName ?? '—',
    value: amount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    branch: inv.branchName || (inv.branchId ? inv.branchId.slice(0, 8) : '—'),
    currency: inv.currency || '—',
    status: inv.statusLabel || inv.status,
    remainingDays: inv.remainingDays || '—',
    sent: inv.documentUuid || '—',
    submissionDate: formatElectronicInvoiceDate(inv.submissionDate),
    sentBy: inv.sentBy?.trim() || '—',
  };
}

export function buildElectronicInvoiceReportQueryParams(filterData: {
  customerId: string;
  delegateId: string;
  warehouseId: string;
  branchId: string;
  itemId: string;
  itemGroupId: string;
  costCenterId: string;
  sentByUserId: string;
  invoiceDateFrom: string;
  invoiceDateTo: string;
  submittedFrom: string;
  submittedTo: string;
  invoiceNumber: string;
  invoiceSelection: string;
  patternIds: string[];
  page: number;
}): Record<string, string | number | undefined> {
  return {
    customerId: filterData.customerId.trim() || undefined,
    delegateId: filterData.delegateId.trim() || undefined,
    warehouseId: filterData.warehouseId.trim() || undefined,
    branchId: filterData.branchId.trim() || undefined,
    itemId: filterData.itemId.trim() || undefined,
    itemGroupId: filterData.itemGroupId.trim() || undefined,
    costCenterId: filterData.costCenterId.trim() || undefined,
    sentByUserId: filterData.sentByUserId.trim() || undefined,
    fromDate: filterData.invoiceDateFrom || undefined,
    toDate: filterData.invoiceDateTo || undefined,
    submittedFrom: filterData.submittedFrom || undefined,
    submittedTo: filterData.submittedTo || undefined,
    invoiceNumber: filterData.invoiceNumber.trim() || undefined,
    invoiceSelection: filterData.invoiceSelection || undefined,
    patternIds: filterData.patternIds.length ? filterData.patternIds.join(',') : undefined,
    page: filterData.page,
    limit: 50,
  };
}
