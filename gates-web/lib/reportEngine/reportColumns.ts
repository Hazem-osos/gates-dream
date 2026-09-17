import type { ReportCellFormat } from './reportFormatters';
import {
  INVOICE_TYPE_BADGES,
  PAYMENT_STATUS_BADGES,
  POS_PAYMENT_TYPE_BADGES,
  resolveInvoiceDisplayStatus,
} from './reportFormatters';
import { labelForAutoColumn } from './reportColumnLabels';

export type ReportColumnDef<T extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  label: string;
  accessor?: keyof T & string;
  getValue?: (row: T) => unknown;
  format?: ReportCellFormat;
  badgeMap?: Record<string, { label: string; className: string }>;
  /** Recommended default visibility */
  defaultVisible?: boolean;
  /** Hidden from UI and export unless user explicitly enables */
  technical?: boolean;
};

export const TECHNICAL_COLUMN_IDS = new Set([
  'id',
  'companyId',
  'branchId',
  'fiscalYearId',
  'sourceYearId',
  'customerId',
  'supplierId',
  'accountId',
  'warehouseId',
  'costCenterId',
  'representativeId',
  'delegateId',
  'currencyId',
  'journalEntryId',
  'costJournalEntryId',
  'createdBy',
  'updatedBy',
  'postedBy',
  'workflowSubmittedBy',
  'workflowApprovedBy',
  'workflowRejectedBy',
  'sellerId',
  'taxSubmissionId',
  'lines',
  'conditions',
  'settlements',
  'paymentSplits',
  'internalNotes',
  'taxSignature',
  'taxHash',
  'lineId',
  'version',
  'expectedVersion',
  'deletedAt',
]);

export type SalesInvoiceReportRow = Record<string, unknown>;

export const SALES_REPORT_COLUMNS: ReportColumnDef<SalesInvoiceReportRow>[] = [
  {
    id: 'invoiceNumber',
    label: 'رقم الفاتورة',
    accessor: 'invoiceNumber',
    format: 'text',
    defaultVisible: true,
  },
  {
    id: 'date',
    label: 'التاريخ',
    accessor: 'date',
    format: 'date',
    defaultVisible: true,
  },
  {
    id: 'invoiceType',
    label: 'نوع الفاتورة',
    getValue: (row) => row.invoiceKind ?? row.invoiceType,
    format: 'badge',
    badgeMap: INVOICE_TYPE_BADGES,
    defaultVisible: true,
  },
  {
    id: 'description',
    label: 'البيان',
    accessor: 'description',
    format: 'text',
    defaultVisible: true,
  },
  {
    id: 'currencyCode',
    label: 'العملة',
    accessor: 'currencyCode',
    format: 'text',
    defaultVisible: true,
  },
  {
    id: 'totalAmount',
    label: 'إجمالي الفاتورة',
    accessor: 'totalAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'status',
    label: 'الحالة',
    getValue: (row) => resolveInvoiceDisplayStatus(row),
    format: 'badge',
    badgeMap: PAYMENT_STATUS_BADGES,
    defaultVisible: true,
  },
  {
    id: 'customer',
    label: 'العميل',
    accessor: 'customer',
    format: 'relation',
    defaultVisible: true,
  },
  {
    id: 'warehouse',
    label: 'المخزن',
    accessor: 'warehouse',
    format: 'relation',
    defaultVisible: true,
  },
  {
    id: 'delegate',
    label: 'المندوب',
    accessor: 'delegate',
    format: 'relation',
    defaultVisible: true,
  },
  {
    id: 'netAmount',
    label: 'صافي الفاتورة',
    accessor: 'netAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'paidAmount',
    label: 'المحصل',
    accessor: 'paidAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'remainingAmount',
    label: 'المتبقي',
    accessor: 'remainingAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'discountAmount',
    label: 'الخصم',
    accessor: 'discountAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'taxAmount',
    label: 'الضريبة',
    accessor: 'taxAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'postedAt',
    label: 'تاريخ الترحيل',
    accessor: 'postedAt',
    format: 'datetime',
    defaultVisible: true,
  },
];

export const POS_DAILY_REPORT_COLUMNS: ReportColumnDef<SalesInvoiceReportRow>[] = [
  {
    id: 'invoiceNumber',
    label: 'رقم الفاتورة',
    accessor: 'invoiceNumber',
    format: 'text',
    defaultVisible: true,
  },
  {
    id: 'date',
    label: 'التاريخ',
    accessor: 'date',
    format: 'datetime',
    defaultVisible: true,
  },
  {
    id: 'warehouse',
    label: 'المخزن',
    accessor: 'warehouse',
    format: 'relation',
    defaultVisible: true,
  },
  {
    id: 'customer',
    label: 'العميل',
    accessor: 'customer',
    format: 'relation',
    defaultVisible: true,
  },
  {
    id: 'paymentType',
    label: 'طريقة الدفع',
    getValue: (row) => row.paymentType ?? row.paymentMethod,
    format: 'badge',
    badgeMap: POS_PAYMENT_TYPE_BADGES,
    defaultVisible: true,
  },
  {
    id: 'description',
    label: 'البيان',
    accessor: 'description',
    format: 'text',
    defaultVisible: true,
  },
  {
    id: 'currencyCode',
    label: 'العملة',
    accessor: 'currencyCode',
    format: 'text',
    defaultVisible: true,
  },
  {
    id: 'totalAmount',
    label: 'إجمالي الفاتورة',
    accessor: 'totalAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'discountAmount',
    label: 'الخصم',
    accessor: 'discountAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'taxAmount',
    label: 'الضريبة',
    accessor: 'taxAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'netAmount',
    label: 'صافي المبيعات',
    accessor: 'netAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'paidAmount',
    label: 'المحصل',
    accessor: 'paidAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'remainingAmount',
    label: 'المتبقي',
    accessor: 'remainingAmount',
    format: 'money',
    defaultVisible: true,
  },
  {
    id: 'status',
    label: 'الحالة',
    getValue: (row) => resolveInvoiceDisplayStatus(row),
    format: 'badge',
    badgeMap: PAYMENT_STATUS_BADGES,
    defaultVisible: true,
  },
];

const REPORT_COLUMNS_BY_PATH: Record<string, ReportColumnDef[]> = {
  'inventory/reports/sales-reports': SALES_REPORT_COLUMNS,
  'pos/daily': POS_DAILY_REPORT_COLUMNS,
};

function guessFormat(key: string): ReportCellFormat {
  if (/date|At$/i.test(key) && key !== 'updatedAt') return key.endsWith('At') ? 'datetime' : 'date';
  if (
    /amount|total|price|cost|balance|paid|profit|tax|discount|net|debit|credit|budget|actual|variance|expenses/i.test(
      key
    )
  ) {
    return 'money';
  }
  if (/^(account|costCenter|customer|supplier|safe|bankAccount|branch)$/i.test(key)) {
    return 'relation';
  }
  if (/quantity|count|qty/i.test(key)) return 'number';
  return 'text';
}

export function getReportColumnsForPath(
  registryPath: string,
  rows: Record<string, unknown>[]
): ReportColumnDef[] {
  const preset = REPORT_COLUMNS_BY_PATH[registryPath];
  if (preset) return preset;

  if (!rows.length) return [];

  const keys = Object.keys(rows[0]).filter((k) => !TECHNICAL_COLUMN_IDS.has(k));
  return keys.map((key) => ({
    id: key,
    label: labelForAutoColumn(key),
    accessor: key,
    format: guessFormat(key),
    defaultVisible: !TECHNICAL_COLUMN_IDS.has(key),
    technical: TECHNICAL_COLUMN_IDS.has(key),
  }));
}

/** Every non-technical column — reports open with the full grid. */
export function getDefaultVisibleColumnIds(columns: ReportColumnDef[]): string[] {
  return columns.filter((c) => !c.technical).map((c) => c.id);
}

export function getRowCellValue<T extends Record<string, unknown>>(
  row: T,
  col: ReportColumnDef<T>
): unknown {
  if (col.getValue) return col.getValue(row);
  if (col.accessor) return row[col.accessor];
  return undefined;
}
