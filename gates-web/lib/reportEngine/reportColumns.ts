import type { ReportCellFormat } from './reportFormatters';
import {
  INVOICE_TYPE_BADGES,
  PAYMENT_STATUS_BADGES,
  POS_PAYMENT_TYPE_BADGES,
  resolveInvoiceDisplayStatus,
} from './reportFormatters';
import { accountTypeLabel, labelForAutoColumn } from './reportColumnLabels';
import { journalSourceLabelFromRow } from '../accounting/journal-source';

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
  /** Ledger balance shows the last figure. Price is not summed. Other numbers are summed. */
  totalMode?: 'sum' | 'last' | 'none' | 'withOpening' | 'net';
  /** Shown from «إظهار بيانات الصنف» on جرد الأصناف. */
  detail?: boolean;
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
  'depth',
  'accountKind',
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
  'groupKey',
  'lines',
  'sourceKind',
  'sourceId',
  'entryType',
  'voucherFund',
  'sourceDocumentId',
  'transferId',
  'invoiceId',
  'itemId',
  'invoicePreviewPath',
  'sourcePreviewPath',
  'href',
  'accountPath',
  'rowKind',
  'depth',
  'isGroup',
  'parentId',
  'priorBalance',
  'side',
  'lineId',
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

const DOCUMENT_STATUS_BADGES = {
  POSTED: { label: 'مرحلة', className: 'bg-sky-100 text-sky-800' },
  UNPOSTED: { label: 'غير مرحلة', className: 'bg-slate-100 text-slate-700' },
};

const SALES_PAYMENT_STATUS_BADGES = {
  PAID: { label: 'مسددة', className: 'bg-green-100 text-green-800' },
  PARTIALLY_PAID: { label: 'مسددة جزئياً', className: 'bg-yellow-100 text-yellow-900' },
  UNPAID: { label: 'غير مسددة', className: 'bg-slate-100 text-slate-700' },
};

const SALES_PAYMENT_TYPE_BADGES = {
  cash: { label: 'نقدي', className: 'bg-emerald-100 text-emerald-800' },
  credit: { label: 'آجل', className: 'bg-sky-100 text-sky-800' },
  split: { label: 'مجزأ', className: 'bg-amber-100 text-amber-900' },
};

/** Sales report only. Sales returns keep SALES_REPORT_COLUMNS. */
export const SALES_DOCUMENT_REPORT_COLUMNS: ReportColumnDef<SalesInvoiceReportRow>[] = [
  { id: 'invoiceNumber', label: 'رقم الفاتورة', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
  { id: 'invoicePattern', label: 'نوعها', accessor: 'invoicePattern', format: 'text', defaultVisible: true },
  { id: 'date', label: 'التاريخ', accessor: 'date', format: 'date', defaultVisible: true },
  {
    id: 'paymentMethod',
    label: 'نوع الفاتورة',
    accessor: 'paymentMethod',
    format: 'badge',
    badgeMap: SALES_PAYMENT_TYPE_BADGES,
    defaultVisible: true,
  },
  {
    id: 'documentStatus',
    label: 'الحالة',
    accessor: 'documentStatus',
    format: 'badge',
    badgeMap: DOCUMENT_STATUS_BADGES,
    defaultVisible: true,
  },
  {
    id: 'paymentStatus',
    label: 'موقف السداد',
    accessor: 'paymentStatus',
    format: 'badge',
    badgeMap: SALES_PAYMENT_STATUS_BADGES,
    defaultVisible: true,
  },
  { id: 'customer', label: 'العميل', accessor: 'customer', format: 'relation', defaultVisible: true },
  { id: 'warehouse', label: 'المخزن', accessor: 'warehouse', format: 'relation', defaultVisible: true },
  { id: 'delegate', label: 'المندوب', accessor: 'delegate', format: 'relation', defaultVisible: true },
  { id: 'driver', label: 'السائق', accessor: 'driver', format: 'relation', defaultVisible: true },
  { id: 'distributor', label: 'الموزع', accessor: 'distributor', format: 'relation', defaultVisible: true },
  { id: 'totalAmount', label: 'إجمالي الفاتورة', accessor: 'totalAmount', format: 'money', defaultVisible: true },
  { id: 'additionsAmount', label: 'إجمالي الإضافات', accessor: 'additionsAmount', format: 'money', defaultVisible: true },
  {
    id: 'otherDiscountsAmount',
    label: 'إجمالي الخصومات الأخرى',
    accessor: 'otherDiscountsAmount',
    format: 'money',
    defaultVisible: true,
  },
  { id: 'discountAmount', label: 'الخصم', accessor: 'discountAmount', format: 'money', defaultVisible: true },
  {
    id: 'withholdingTaxAmount',
    label: 'ضريبة خصم المنبع',
    accessor: 'withholdingTaxAmount',
    format: 'money',
    defaultVisible: true,
  },
  { id: 'taxAmount', label: 'ضريبة المبيعات', accessor: 'taxAmount', format: 'money', defaultVisible: true },
  { id: 'netAmount', label: 'الصافي', accessor: 'netAmount', format: 'money', defaultVisible: true },
  { id: 'paidAmount', label: 'قيمة المسدد', accessor: 'paidAmount', format: 'money', defaultVisible: true },
  { id: 'remainingAmount', label: 'المتبقي', accessor: 'remainingAmount', format: 'money', defaultVisible: true },
  {
    id: 'quotationNumber',
    label: 'رقم عرض السعر',
    accessor: 'quotationNumber',
    format: 'text',
    totalMode: 'none',
    defaultVisible: true,
  },
  { id: 'description', label: 'البيان', accessor: 'description', format: 'text', defaultVisible: true },
  { id: 'currencyCode', label: 'العملة', accessor: 'currencyCode', format: 'text', defaultVisible: true },
];

const MOVEMENT_TYPE_BADGES = {
  SALE: { label: 'مبيعات', className: 'bg-emerald-100 text-emerald-800' },
  RETURN: { label: 'مردود مبيعات', className: 'bg-rose-100 text-rose-800' },
};

function invoiceDocumentColumns(options: {
  partyId: 'customer' | 'supplier';
  partyLabel: string;
  taxLabel: string;
  referenceId: string;
  referenceLabel: string;
  netLabel?: string;
  netAccessor?: string;
  movement?: boolean;
}): ReportColumnDef<SalesInvoiceReportRow>[] {
  const leading: ReportColumnDef<SalesInvoiceReportRow>[] = [
    { id: 'invoiceNumber', label: 'رقم الفاتورة', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
    { id: 'invoicePattern', label: 'نوعها', accessor: 'invoicePattern', format: 'text', defaultVisible: true },
    { id: 'date', label: 'التاريخ', accessor: 'date', format: 'date', defaultVisible: true },
  ];
  if (options.movement) {
    leading.push({
      id: 'movementType',
      label: 'نوع الحركة',
      accessor: 'movementType',
      format: 'badge',
      badgeMap: MOVEMENT_TYPE_BADGES,
      defaultVisible: true,
    });
  }
  return [
    ...leading,
    {
      id: 'paymentMethod',
      label: 'نوع الفاتورة',
      accessor: 'paymentMethod',
      format: 'badge',
      badgeMap: SALES_PAYMENT_TYPE_BADGES,
      defaultVisible: true,
    },
    {
      id: 'documentStatus',
      label: 'الحالة',
      accessor: 'documentStatus',
      format: 'badge',
      badgeMap: DOCUMENT_STATUS_BADGES,
      defaultVisible: true,
    },
    {
      id: 'paymentStatus',
      label: 'موقف السداد',
      accessor: 'paymentStatus',
      format: 'badge',
      badgeMap: SALES_PAYMENT_STATUS_BADGES,
      defaultVisible: true,
    },
    { id: options.partyId, label: options.partyLabel, accessor: options.partyId, format: 'relation', defaultVisible: true },
    { id: 'warehouse', label: 'المخزن', accessor: 'warehouse', format: 'relation', defaultVisible: true },
    { id: 'delegate', label: 'المندوب', accessor: 'delegate', format: 'relation', defaultVisible: true },
    { id: 'driver', label: 'السائق', accessor: 'driver', format: 'relation', defaultVisible: true },
    { id: 'distributor', label: 'الموزع', accessor: 'distributor', format: 'relation', defaultVisible: true },
    ...(options.movement
      ? [
          { id: 'grossAmount', label: 'إجمالي المبيعات', accessor: 'grossAmount', format: 'money' as const, defaultVisible: true },
          { id: 'returnAmount', label: 'مردود المبيعات', accessor: 'returnAmount', format: 'money' as const, defaultVisible: true },
        ]
      : [{ id: 'totalAmount', label: 'إجمالي الفاتورة', accessor: 'totalAmount', format: 'money' as const, defaultVisible: true }]),
    { id: 'additionsAmount', label: 'إجمالي الإضافات', accessor: 'additionsAmount', format: 'money', defaultVisible: true },
    { id: 'otherDiscountsAmount', label: 'إجمالي الخصومات الأخرى', accessor: 'otherDiscountsAmount', format: 'money', defaultVisible: true },
    { id: 'discountAmount', label: 'الخصم', accessor: 'discountAmount', format: 'money', defaultVisible: true },
    { id: 'withholdingTaxAmount', label: 'ضريبة خصم المنبع', accessor: 'withholdingTaxAmount', format: 'money', defaultVisible: true },
    { id: 'taxAmount', label: options.taxLabel, accessor: 'taxAmount', format: 'money', defaultVisible: true },
    {
      id: options.netAccessor ?? 'netAmount',
      label: options.netLabel ?? 'الصافي',
      accessor: options.netAccessor ?? 'netAmount',
      format: 'money',
      defaultVisible: true,
    },
    { id: 'paidAmount', label: 'قيمة المسدد', accessor: 'paidAmount', format: 'money', defaultVisible: true },
    { id: 'remainingAmount', label: 'المتبقي', accessor: 'remainingAmount', format: 'money', defaultVisible: true },
    {
      id: options.referenceId,
      label: options.referenceLabel,
      accessor: options.referenceId,
      format: 'text',
      totalMode: 'none',
      defaultVisible: true,
    },
    { id: 'description', label: 'البيان', accessor: 'description', format: 'text', defaultVisible: true },
    { id: 'currencyCode', label: 'العملة', accessor: 'currencyCode', format: 'text', defaultVisible: true },
  ];
}

export const PURCHASE_DOCUMENT_REPORT_COLUMNS = invoiceDocumentColumns({
  partyId: 'supplier',
  partyLabel: 'المورد',
  taxLabel: 'ضريبة المشتريات',
  referenceId: 'purchaseOrderNumber',
  referenceLabel: 'رقم أمر الشراء',
});

export const SALES_RETURN_DOCUMENT_REPORT_COLUMNS = invoiceDocumentColumns({
  partyId: 'customer',
  partyLabel: 'العميل',
  taxLabel: 'ضريبة المبيعات',
  referenceId: 'originalInvoiceNumber',
  referenceLabel: 'فاتورة المبيعات الأصلية',
});

export const PURCHASE_RETURN_DOCUMENT_REPORT_COLUMNS = invoiceDocumentColumns({
  partyId: 'supplier',
  partyLabel: 'المورد',
  taxLabel: 'ضريبة المشتريات',
  referenceId: 'originalInvoiceNumber',
  referenceLabel: 'فاتورة المشتريات الأصلية',
});

export const SALES_WITH_RETURNS_REPORT_COLUMNS = invoiceDocumentColumns({
  partyId: 'customer',
  partyLabel: 'العميل',
  taxLabel: 'ضريبة المبيعات',
  referenceId: 'quotationNumber',
  referenceLabel: 'رقم عرض السعر',
  netLabel: 'الصافي',
  netAccessor: 'signedNet',
  movement: true,
});

export const PURCHASE_RETURN_REPORT_COLUMNS: ReportColumnDef<SalesInvoiceReportRow>[] = [
  { id: 'invoiceNumber', label: 'رقم الفاتورة', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
  {
    id: 'invoiceType',
    label: 'نوع الفاتورة',
    getValue: (row) => row.invoiceKind ?? row.invoiceType,
    format: 'badge',
    badgeMap: INVOICE_TYPE_BADGES,
    defaultVisible: true,
  },
  { id: 'date', label: 'التاريخ', accessor: 'date', format: 'date', defaultVisible: true },
  { id: 'supplier', label: 'اسم المورد', accessor: 'supplier', format: 'relation', defaultVisible: true },
  { id: 'netAmount', label: 'صافي القيمة', accessor: 'netAmount', format: 'money', defaultVisible: true },
  { id: 'paidAmount', label: 'المدفوع', accessor: 'paidAmount', format: 'money', defaultVisible: true },
  { id: 'remainingAmount', label: 'المتبقي', accessor: 'remainingAmount', format: 'money', defaultVisible: true },
  { id: 'description', label: 'الشرح', accessor: 'description', format: 'text', defaultVisible: true },
  { id: 'amountBeforeTax', label: 'إجمالي بدون ضريبة', accessor: 'amountBeforeTax', format: 'money', defaultVisible: true },
  {
    id: 'status',
    label: 'حالة الفاتورة',
    getValue: (row) => resolveInvoiceDisplayStatus(row),
    format: 'badge',
    badgeMap: PAYMENT_STATUS_BADGES,
    defaultVisible: true,
  },
  {
    id: 'discountsAndAdditions',
    label: 'خصومات وإضافات',
    accessor: 'discountsAndAdditions',
    format: 'money',
    defaultVisible: true,
  },
  { id: 'taxAmount', label: 'ضريبة قيمة مضافة', accessor: 'taxAmount', format: 'money', defaultVisible: true },
  {
    id: 'withholdingTaxAmount',
    label: 'ضريبة خصم المنبع',
    accessor: 'withholdingTaxAmount',
    format: 'money',
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

export const ITEM_MOVEMENT_COLUMNS: ReportColumnDef[] = [
  { id: 'date', label: 'التاريخ', accessor: 'date', format: 'date', defaultVisible: true },
  { id: 'sourceLabel', label: 'المصدر', accessor: 'sourceLabel', format: 'text', defaultVisible: true },
  { id: 'sourceNumber', label: 'رقمه', accessor: 'sourceNumber', format: 'text', defaultVisible: true },
  { id: 'itemName', label: 'الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
  { id: 'warehouseName', label: 'المخزن', accessor: 'warehouseName', format: 'text', defaultVisible: true },
  { id: 'partyName', label: 'المورد أو العميل', accessor: 'partyName', format: 'text', defaultVisible: true },
  { id: 'description', label: 'الشرح', accessor: 'description', format: 'text', defaultVisible: true },
  { id: 'unitName', label: 'الوحدة', accessor: 'unitName', format: 'text', defaultVisible: true },
  { id: 'inQty', label: 'كمية داخلة', accessor: 'inQty', format: 'number', defaultVisible: true },
  { id: 'inPrice', label: 'سعر داخل', accessor: 'inPrice', format: 'money', defaultVisible: true },
  { id: 'inTotal', label: 'إجمالي داخل', accessor: 'inTotal', format: 'money', defaultVisible: true },
  { id: 'outQty', label: 'كمية خارجة', accessor: 'outQty', format: 'number', defaultVisible: true },
  { id: 'outPrice', label: 'سعر خارج', accessor: 'outPrice', format: 'money', defaultVisible: true },
  { id: 'outTotal', label: 'إجمالي خارج', accessor: 'outTotal', format: 'money', defaultVisible: true },
  { id: 'balance', label: 'الرصيد', accessor: 'balance', format: 'number', defaultVisible: true },
  { id: 'itemGroupName', label: 'مجموعة الأصناف', accessor: 'itemGroupName', format: 'text', defaultVisible: true },
  { id: 'color', label: 'اللون', accessor: 'color', format: 'text', defaultVisible: true },
  { id: 'origin', label: 'المنشأ', accessor: 'origin', format: 'text', defaultVisible: true },
  { id: 'quality', label: 'النوعية', accessor: 'quality', format: 'text', defaultVisible: true },
  { id: 'size', label: 'المقاس', accessor: 'size', format: 'text', defaultVisible: true },
  { id: 'upperLimit', label: 'الحد الأعلى', accessor: 'upperLimit', format: 'number', defaultVisible: true },
  { id: 'minPurchasePrice', label: 'أقل سعر شراء', accessor: 'minPurchasePrice', format: 'money', defaultVisible: true },
  { id: 'avgPurchasePrice', label: 'متوسط سعر شراء', accessor: 'avgPurchasePrice', format: 'money', defaultVisible: true },
  { id: 'maxPurchasePrice', label: 'أعلى سعر شراء', accessor: 'maxPurchasePrice', format: 'money', defaultVisible: true },
  { id: 'minSalePrice', label: 'أقل سعر بيع', accessor: 'minSalePrice', format: 'money', defaultVisible: true },
  { id: 'avgSalePrice', label: 'متوسط سعر بيع', accessor: 'avgSalePrice', format: 'money', defaultVisible: true },
  { id: 'maxSalePrice', label: 'أعلى سعر بيع', accessor: 'maxSalePrice', format: 'money', defaultVisible: true },
  { id: 'costCenterName', label: 'مركز التكلفة', accessor: 'costCenterName', format: 'text', defaultVisible: true },
  { id: 'discountPercent', label: 'نسبة الخصم', accessor: 'discountPercent', format: 'number', defaultVisible: true },
  { id: 'discountAmount', label: 'قيمة الخصم', accessor: 'discountAmount', format: 'money', defaultVisible: true },
  { id: 'taxPercent', label: 'نسبة الضريبة', accessor: 'taxPercent', format: 'number', defaultVisible: true },
  { id: 'taxAmount', label: 'قيمة الضريبة', accessor: 'taxAmount', format: 'money', defaultVisible: true },
  { id: 'expiryDate', label: 'تاريخ الصلاحية', accessor: 'expiryDate', format: 'date', defaultVisible: true },
  { id: 'delegateName', label: 'المندوب', accessor: 'delegateName', format: 'text', defaultVisible: true },
];

const SALES_MONTH_LABELS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const MONTHLY_ITEM_MEASURES: Array<{ suffix: string; label: string; format: 'number' | 'money' }> = [
  { suffix: 'SaleQty', label: 'كمية المبيعات', format: 'number' },
  { suffix: 'SaleAmount', label: 'قيمة المبيعات', format: 'money' },
  { suffix: 'ReturnQty', label: 'كمية المردودات', format: 'number' },
  { suffix: 'ReturnAmount', label: 'قيمة المردودات', format: 'money' },
  { suffix: 'NetQty', label: 'صافي الكمية', format: 'number' },
  { suffix: 'NetAmount', label: 'صافي القيمة', format: 'money' },
];

export const MONTHLY_ITEM_SALES_COLUMNS: ReportColumnDef[] = [
  { id: 'itemName', label: 'الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
  ...SALES_MONTH_LABELS.flatMap((label, index) => {
    const month = index + 1;
    return MONTHLY_ITEM_MEASURES.map((measure) => ({
      id: `m${month}${measure.suffix}`,
      label: `${label} — ${measure.label}`,
      accessor: `m${month}${measure.suffix}`,
      format: measure.format,
      defaultVisible: true,
    }));
  }),
  ...MONTHLY_ITEM_MEASURES.map((measure) => ({
    id: measure.suffix.charAt(0).toLowerCase() + measure.suffix.slice(1),
    label: measure.label,
    accessor: measure.suffix.charAt(0).toLowerCase() + measure.suffix.slice(1),
    format: measure.format,
    defaultVisible: true,
  })),
];

export const EXPIRY_DATE_COLUMNS: ReportColumnDef[] = [
  { id: 'status', label: 'الحالة', accessor: 'status', format: 'text', defaultVisible: true },
  { id: 'itemName', label: 'الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
  { id: 'warehouseName', label: 'المخزن', accessor: 'warehouseName', format: 'text', defaultVisible: true },
  { id: 'batchNumber', label: 'التشغيلة', accessor: 'batchNumber', format: 'text', defaultVisible: true },
  { id: 'expiryDate', label: 'تاريخ الصلاحية', accessor: 'expiryDate', format: 'date', defaultVisible: true },
  { id: 'daysLeft', label: 'الأيام المتبقية', accessor: 'daysLeft', format: 'number', defaultVisible: true },
  { id: 'quantity', label: 'الرصيد', accessor: 'quantity', format: 'number', defaultVisible: true },
  { id: 'unitName', label: 'الوحدة', accessor: 'unitName', format: 'text', defaultVisible: true },
  { id: 'sourceLabel', label: 'المصدر', accessor: 'sourceLabel', format: 'text', defaultVisible: true },
  { id: 'sourceNumber', label: 'الرقم', accessor: 'sourceNumber', format: 'text', defaultVisible: true },
  { id: 'partyName', label: 'الجهة', accessor: 'partyName', format: 'text', defaultVisible: true },
  { id: 'itemGroupName', label: 'المجموعة', accessor: 'itemGroupName', format: 'text', defaultVisible: true },
];

export const FINANCIAL_PAPERS_COLUMNS: ReportColumnDef[] = [
  { id: 'paperNumber', label: 'رقم الورقة', accessor: 'paperNumber', format: 'text', defaultVisible: true },
  { id: 'paperType', label: 'نوع الورقة', accessor: 'paperType', format: 'text', defaultVisible: true },
  { id: 'issueDate', label: 'تاريخ التحرير', accessor: 'issueDate', format: 'date', defaultVisible: true },
  { id: 'dueDate', label: 'تاريخ الاستحقاق', accessor: 'dueDate', format: 'date', defaultVisible: true },
  { id: 'accountName', label: 'الحساب', accessor: 'accountName', format: 'text', defaultVisible: true },
  { id: 'description', label: 'الشرح', accessor: 'description', format: 'text', defaultVisible: true },
  { id: 'entityName', label: 'الجهة', accessor: 'entityName', format: 'text', defaultVisible: true },
  { id: 'amount', label: 'المبلغ', accessor: 'amount', format: 'money', defaultVisible: true },
  { id: 'paperStatus', label: 'حالة الورقة', accessor: 'paperStatus', format: 'text', defaultVisible: true },
  { id: 'collectionDate', label: 'تاريخ التحصيل', accessor: 'collectionDate', format: 'date', defaultVisible: true },
  { id: 'endorsementDate', label: 'تاريخ التظهير', accessor: 'endorsementDate', format: 'date', defaultVisible: true },
  { id: 'returnDate', label: 'تاريخ الرد', accessor: 'returnDate', format: 'date', defaultVisible: true },
  { id: 'currencyName', label: 'العملة الأصلية', accessor: 'currencyName', format: 'text', defaultVisible: true },
  { id: 'costCenterName', label: 'مركز التكلفة', accessor: 'costCenterName', format: 'text', defaultVisible: true },
  { id: 'portfolioName', label: 'الصندوق', accessor: 'portfolioName', format: 'text', defaultVisible: true },
];

const priceListMoney = (id: string, label: string): ReportColumnDef => ({
  id,
  label,
  accessor: id,
  format: 'money',
  totalMode: 'none',
  defaultVisible: true,
});

export const PRICE_LIST_COLUMNS: ReportColumnDef[] = [
  { id: 'itemSerial', label: 'كود الصنف', accessor: 'itemSerial', format: 'text', defaultVisible: true },
  { id: 'itemName', label: 'اسم الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
  { id: 'priceListName', label: 'قائمة الأسعار', accessor: 'priceListName', format: 'text', defaultVisible: true },
  { id: 'unitName', label: 'الوحدة', accessor: 'unitName', format: 'text', defaultVisible: true },
  priceListMoney('itemPurchasePrice', 'سعر شراء الصنف'),
  priceListMoney('itemSalePrice', 'سعر بيع الصنف'),
  priceListMoney('listPurchasePrice', 'سعر شراء قائمة السعر'),
  priceListMoney('listSalePrice', 'سعر بيع قائمة السعر'),
];

export const ITEMS_EXCEEDING_ORDER_LIMIT_COLUMNS: ReportColumnDef[] = [
  { id: 'warehouseName', label: 'اسم المخزن', accessor: 'warehouseName', format: 'text', defaultVisible: true },
  { id: 'itemSerial', label: 'كود الصنف', accessor: 'itemSerial', format: 'text', defaultVisible: true },
  { id: 'itemName', label: 'اسم الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
  { id: 'currentQuantity', label: 'الكمية الحالية', accessor: 'currentQuantity', format: 'number', defaultVisible: true },
  { id: 'orderLimit', label: 'حد الطلب', accessor: 'orderLimit', format: 'number', defaultVisible: true },
  { id: 'lowerLimit', label: 'الحد الأدنى', accessor: 'lowerLimit', format: 'number', defaultVisible: true },
  { id: 'upperLimit', label: 'الحد الأعلى', accessor: 'upperLimit', format: 'number', defaultVisible: true },
  { id: 'difference', label: 'الفرق', accessor: 'difference', format: 'number', defaultVisible: true },
  { id: 'status', label: 'الحالة', accessor: 'status', format: 'text', defaultVisible: true },
];

export const PURCHASE_REPORT_COLUMNS: ReportColumnDef<SalesInvoiceReportRow>[] = [
  { id: 'invoiceNumber', label: 'رقم الفاتورة', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
  { id: 'date', label: 'التاريخ', accessor: 'date', format: 'date', defaultVisible: true },
  { id: 'supplier', label: 'المورد', accessor: 'supplier', format: 'relation', defaultVisible: true },
  { id: 'warehouse', label: 'المخزن', accessor: 'warehouse', format: 'relation', defaultVisible: true },
  { id: 'description', label: 'البيان', accessor: 'description', format: 'text', defaultVisible: true },
  { id: 'currencyCode', label: 'العملة', accessor: 'currencyCode', format: 'text', defaultVisible: true },
  { id: 'totalAmount', label: 'إجمالي الفاتورة', accessor: 'totalAmount', format: 'money', defaultVisible: true },
  { id: 'discountAmount', label: 'الخصم', accessor: 'discountAmount', format: 'money', defaultVisible: true },
  { id: 'taxAmount', label: 'الضريبة', accessor: 'taxAmount', format: 'money', defaultVisible: true },
  {
    id: 'withholdingTaxAmount',
    label: 'ضريبة الخصم',
    accessor: 'withholdingTaxAmount',
    format: 'money',
    defaultVisible: true,
  },
  { id: 'netAmount', label: 'الصافي', accessor: 'netAmount', format: 'money', defaultVisible: true },
  { id: 'paidAmount', label: 'المدفوع', accessor: 'paidAmount', format: 'money', defaultVisible: true },
  { id: 'remainingAmount', label: 'المتبقي', accessor: 'remainingAmount', format: 'money', defaultVisible: true },
  {
    id: 'status',
    label: 'الحالة',
    getValue: (row) => resolveInvoiceDisplayStatus(row),
    format: 'badge',
    badgeMap: PAYMENT_STATUS_BADGES,
    defaultVisible: true,
  },
];

export const SALES_PURCHASE_TAX_COLUMNS: ReportColumnDef[] = [
  { id: 'year', label: 'السنة', accessor: 'year', format: 'text', defaultVisible: true },
  { id: 'month', label: 'الشهر', accessor: 'month', format: 'text', defaultVisible: true },
  { id: 'salesAmount', label: 'المبيعات', accessor: 'salesAmount', format: 'money', defaultVisible: true },
  { id: 'salesTax', label: 'الضريبة', accessor: 'salesTax', format: 'money', defaultVisible: true },
  { id: 'salesReturnAmount', label: 'مرتجعات مبيعات', accessor: 'salesReturnAmount', format: 'money', defaultVisible: true },
  { id: 'salesReturnTax', label: 'الضريبة', accessor: 'salesReturnTax', format: 'money', defaultVisible: true },
  { id: 'netSales', label: 'صافي المبيعات', accessor: 'netSales', format: 'money', defaultVisible: true },
  { id: 'netSalesTax', label: 'صافي الضريبة', accessor: 'netSalesTax', format: 'money', defaultVisible: true },
  { id: 'purchaseAmount', label: 'المشتريات', accessor: 'purchaseAmount', format: 'money', defaultVisible: true },
  { id: 'purchaseTax', label: 'الضريبة', accessor: 'purchaseTax', format: 'money', defaultVisible: true },
  { id: 'purchaseReturnAmount', label: 'مرتجعات مشتريات', accessor: 'purchaseReturnAmount', format: 'money', defaultVisible: true },
  { id: 'purchaseReturnTax', label: 'الضريبة', accessor: 'purchaseReturnTax', format: 'money', defaultVisible: true },
  { id: 'netPurchases', label: 'صافي المشتريات', accessor: 'netPurchases', format: 'money', defaultVisible: true },
  { id: 'netPurchaseTax', label: 'صافي الضريبة', accessor: 'netPurchaseTax', format: 'money', defaultVisible: true },
  { id: 'finalTax', label: 'الضريبة النهائية', accessor: 'finalTax', format: 'money', defaultVisible: true },
];

export const ANALYTICAL_INVOICE_COLUMNS: ReportColumnDef[] = [
  { id: 'sourceTypeLabel', label: 'القسم', accessor: 'sourceTypeLabel', format: 'text', defaultVisible: true },
  { id: 'sourceNumber', label: 'المستند', accessor: 'sourceNumber', format: 'text', defaultVisible: true },
  { id: 'sourceDate', label: 'التاريخ', accessor: 'sourceDate', format: 'date', defaultVisible: true },
  { id: 'partyName', label: 'الجهة', accessor: 'partyName', format: 'text', defaultVisible: true },
  { id: 'itemName', label: 'الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
  { id: 'unitName', label: 'الوحدة', accessor: 'unitName', format: 'text', defaultVisible: true },
  { id: 'orderedQty', label: 'الكمية', accessor: 'orderedQty', format: 'number', defaultVisible: true },
  { id: 'unitPrice', label: 'السعر', accessor: 'unitPrice', format: 'money', defaultVisible: true },
  { id: 'orderedTotal', label: 'الإجمالي', accessor: 'orderedTotal', format: 'money', defaultVisible: true },
  { id: 'issuedQty', label: 'المصروف', accessor: 'issuedQty', format: 'number', defaultVisible: true },
  { id: 'remainingQty', label: 'المتبقي', accessor: 'remainingQty', format: 'number', defaultVisible: true },
  { id: 'invoiceNumber', label: 'الفاتورة', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
  { id: 'status', label: 'الحالة', accessor: 'status', format: 'text', defaultVisible: true },
];

/** كشف الحساب: دفتر ثم تحليل الفاتورة، بدون الدمغة والعامة والبائع والهدايا. */
function partyStatementColumns(partyLabel: string): ReportColumnDef[] {
  return [
    { id: 'date', label: 'التاريخ', accessor: 'date', format: 'date', defaultVisible: true },
    { id: 'invoiceNumber', label: 'الرقم', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
    { id: 'debit', label: 'مدين', accessor: 'debit', format: 'money', defaultVisible: true },
    { id: 'credit', label: 'دائن', accessor: 'credit', format: 'money', defaultVisible: true },
    { id: 'description', label: 'الشرح', accessor: 'description', format: 'text', defaultVisible: true },
    { id: 'runningBalance', label: 'الرصيد', accessor: 'runningBalance', format: 'money', totalMode: 'last', defaultVisible: true },
    { id: 'sourceName', label: 'مصدرها', accessor: 'sourceName', format: 'text', defaultVisible: true },
    { id: 'netAmount', label: 'صافي الفاتورة', accessor: 'netAmount', format: 'money', defaultVisible: true },
    { id: 'paidAmount', label: 'المدفوع', accessor: 'paidAmount', format: 'money', defaultVisible: true },
    { id: 'remainingAmount', label: 'المتبقي', accessor: 'remainingAmount', format: 'money', defaultVisible: true },
    { id: 'grossExTax', label: 'إجمالي الفاتورة بدون ضريبة', accessor: 'grossExTax', format: 'money', defaultVisible: true },
    { id: 'taxAmount', label: 'ضريبة المبيعات', accessor: 'taxAmount', format: 'money', defaultVisible: true },
    { id: 'additionsAmount', label: 'إضافات', accessor: 'additionsAmount', format: 'money', defaultVisible: true },
    { id: 'withholdingTaxAmount', label: 'ضريبة خصم', accessor: 'withholdingTaxAmount', format: 'money', defaultVisible: true },
    { id: 'delegate', label: 'المندوب', accessor: 'delegate', format: 'text', defaultVisible: true },
    { id: 'partyName', label: partyLabel, accessor: 'partyName', format: 'text', defaultVisible: true },
  ];
}

export const CUSTOMER_ACCOUNT_COLUMNS = partyStatementColumns('العميل');
export const SUPPLIER_ACCOUNT_COLUMNS = partyStatementColumns('المورد');

export type ReportCurrencyColumn = { code: string; name: string };

export function parseSummaryCurrencies(summary: unknown): ReportCurrencyColumn[] {
  if (!summary || typeof summary !== 'object') return [];
  const raw = (summary as Record<string, unknown>).currencies;
  if (!Array.isArray(raw)) return [];
  const out: ReportCurrencyColumn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const code = String((item as { code?: unknown }).code || '')
      .trim()
      .toUpperCase();
    const name = String((item as { name?: unknown }).name || code).trim();
    if (code) out.push({ code, name: name || code });
  }
  return out;
}

export function partyCurrencyStatementColumns(
  partyLabel: string,
  currencies?: ReportCurrencyColumn[]
): ReportColumnDef[] {
  const codeLabel = partyLabel === 'المورد' ? 'كود المورد' : 'كود العميل';
  const lead: ReportColumnDef[] = [
    { id: 'partyCode', label: codeLabel, accessor: 'partyCode', format: 'text', defaultVisible: true },
    { id: 'partyName', label: partyLabel, accessor: 'partyName', format: 'text', defaultVisible: true },
    { id: 'date', label: 'التاريخ', accessor: 'date', format: 'date', defaultVisible: true },
    { id: 'documentNumber', label: 'الرقم', accessor: 'documentNumber', format: 'text', defaultVisible: true },
    { id: 'description', label: 'الشرح', accessor: 'description', format: 'text', defaultVisible: true },
  ];
  const list = currencies?.length ? currencies : [{ code: 'EGP', name: 'جنيه مصري' }];
  const money = list.flatMap((currency) => [
    {
      id: `debit_${currency.code}`,
      label: `مدين ${currency.name}`,
      accessor: `debit_${currency.code}`,
      format: 'money' as const,
      defaultVisible: true,
    },
    {
      id: `credit_${currency.code}`,
      label: `دائن ${currency.name}`,
      accessor: `credit_${currency.code}`,
      format: 'money' as const,
      defaultVisible: true,
    },
    {
      id: `balance_${currency.code}`,
      label: `الرصيد ${currency.name}`,
      accessor: `balance_${currency.code}`,
      format: 'money' as const,
      totalMode: 'last' as const,
      defaultVisible: true,
    },
  ]);
  return [...lead, ...money];
}

export const CUSTOMER_CURRENCY_ACCOUNT_COLUMNS = partyCurrencyStatementColumns('العميل');
export const SUPPLIER_CURRENCY_ACCOUNT_COLUMNS = partyCurrencyStatementColumns('المورد');

export const CUSTOMER_BALANCE_COLUMNS: ReportColumnDef[] = [
  { id: 'accountLabel', label: 'الحساب', accessor: 'accountLabel', format: 'text', defaultVisible: true },
  { id: 'previousBalance', label: 'الرصيد السابق', accessor: 'previousBalance', format: 'money', defaultVisible: true },
  { id: 'debit', label: 'المدين', accessor: 'debit', format: 'money', defaultVisible: true },
  { id: 'credit', label: 'الدائن', accessor: 'credit', format: 'money', defaultVisible: true },
  { id: 'currentBalance', label: 'الرصيد الحالي', accessor: 'currentBalance', format: 'money', defaultVisible: true },
  { id: 'budget', label: 'الموازنة', accessor: 'budget', format: 'money', defaultVisible: true },
  { id: 'budgetRemaining', label: 'المتبقي للموازنة', accessor: 'budgetRemaining', format: 'money', defaultVisible: true },
];

export const COLLECTIONS_AND_OVERDUES_COLUMNS: ReportColumnDef[] = [
  { id: 'customerCode', label: 'كود العميل', accessor: 'customerCode', format: 'text', defaultVisible: true },
  { id: 'customer', label: 'العميل', accessor: 'customer', format: 'relation', defaultVisible: true },
  { id: 'invoiceCount', label: 'عدد الفواتير', accessor: 'invoiceCount', format: 'number', defaultVisible: true },
  { id: 'totalSales', label: 'المبيعات', accessor: 'totalSales', format: 'money', defaultVisible: true },
  { id: 'totalCollections', label: 'التحصيلات', accessor: 'totalCollections', format: 'money', defaultVisible: true },
  { id: 'currentDue', label: 'المستحق', accessor: 'currentDue', format: 'money', defaultVisible: true },
  { id: 'overdueAmount', label: 'المتأخر', accessor: 'overdueAmount', format: 'money', defaultVisible: true },
  { id: 'balance', label: 'الرصيد', accessor: 'balance', format: 'money', defaultVisible: true },
  { id: 'lastInvoiceDate', label: 'آخر فاتورة', accessor: 'lastInvoiceDate', format: 'date', defaultVisible: true },
  { id: 'lastCollectionDate', label: 'آخر تحصيل', accessor: 'lastCollectionDate', format: 'date', defaultVisible: true },
  { id: 'oldestDueDate', label: 'أقدم استحقاق', accessor: 'oldestDueDate', format: 'date', defaultVisible: true },
  { id: 'daysOverdue', label: 'أيام التأخير', accessor: 'daysOverdue', format: 'number', totalMode: 'none', defaultVisible: true },
];

export const CUSTOMER_RECEIVABLES_COLUMNS: ReportColumnDef[] = [
  { id: 'customerName', label: 'العميل', accessor: 'customerName', format: 'text', defaultVisible: true },
  { id: 'invoices', label: 'سابق أو متأخرات', accessor: 'invoices', format: 'money', defaultVisible: true },
  { id: 'notYetDue', label: 'لم تستحق', accessor: 'notYetDue', format: 'money', defaultVisible: true },
  { id: 'pay30', label: '30 يوم — دفعات', accessor: 'pay30', format: 'money', defaultVisible: true },
  { id: 'cheque30', label: '30 يوم — شيكات', accessor: 'cheque30', format: 'money', defaultVisible: true },
  { id: 'pay60', label: '60 يوم — دفعات', accessor: 'pay60', format: 'money', defaultVisible: true },
  { id: 'cheque60', label: '60 يوم — شيكات', accessor: 'cheque60', format: 'money', defaultVisible: true },
  { id: 'pay90', label: '90 يوم — دفعات', accessor: 'pay90', format: 'money', defaultVisible: true },
  { id: 'cheque90', label: '90 يوم — شيكات', accessor: 'cheque90', format: 'money', defaultVisible: true },
  { id: 'payOlder', label: 'أكبر — دفعات', accessor: 'payOlder', format: 'money', defaultVisible: true },
  { id: 'chequeOlder', label: 'أكبر — شيكات', accessor: 'chequeOlder', format: 'money', defaultVisible: true },
  { id: 'totalDue', label: 'إجمالي المستحق', accessor: 'totalDue', format: 'money', defaultVisible: true },
];

function partyItemAccountColumns(): ReportColumnDef[] {
  return [
    { id: 'date', label: 'التاريخ', accessor: 'date', format: 'date', defaultVisible: true },
    { id: 'invoiceNumber', label: 'رقم العملية', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
    { id: 'description', label: 'البيان', accessor: 'description', format: 'text', defaultVisible: true },
    { id: 'itemName', label: 'الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
    { id: 'itemGroupName', label: 'المجموعة', accessor: 'itemGroupName', format: 'text', defaultVisible: true },
    { id: 'unitName', label: 'الوحدة', accessor: 'unitName', format: 'text', defaultVisible: true },
    { id: 'quantity', label: 'الكمية', accessor: 'quantity', format: 'number', defaultVisible: true },
    { id: 'unitPrice', label: 'السعر', accessor: 'unitPrice', format: 'money', totalMode: 'none', defaultVisible: true },
    { id: 'lineInclusiveValue', label: 'القيمة شاملة الضريبة والخصم', accessor: 'lineInclusiveValue', format: 'money', defaultVisible: true },
    { id: 'debit', label: 'مدين', accessor: 'debit', format: 'money', defaultVisible: true },
    { id: 'credit', label: 'دائن', accessor: 'credit', format: 'money', defaultVisible: true },
    { id: 'runningBalance', label: 'الرصيد', accessor: 'runningBalance', format: 'money', totalMode: 'last', defaultVisible: true },
  ];
}

export const PARTY_ITEM_ACCOUNT_COLUMNS = partyItemAccountColumns();

export const INVENTORY_COUNT_COLUMNS: ReportColumnDef[] = [
  { id: 'itemSerial', label: 'رمز الصنف', accessor: 'itemSerial', format: 'text', defaultVisible: true },
  { id: 'itemName', label: 'الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
  { id: 'groupName', label: 'المجموعة', accessor: 'groupName', format: 'text', defaultVisible: true },
  { id: 'warehouseName', label: 'المخزن', accessor: 'warehouseName', format: 'text', defaultVisible: true },
  { id: 'quantityOnHand', label: 'الكمية الحالية', accessor: 'quantityOnHand', format: 'number', defaultVisible: true },
  { id: 'reservedQuantity', label: 'المحجوز', accessor: 'reservedQuantity', format: 'number', defaultVisible: true },
  { id: 'availableQty', label: 'المتاح', accessor: 'availableQty', format: 'number', defaultVisible: true },
  { id: 'totalQuantity', label: 'الرصيد الإجمالي', accessor: 'totalQuantity', format: 'number', totalMode: 'none', defaultVisible: true },
  { id: 'baseUnitName', label: 'الوحدة', accessor: 'baseUnitName', format: 'text', defaultVisible: true },
  { id: 'otherUnitName', label: 'الوحدة الأخرى', accessor: 'otherUnitName', format: 'text', defaultVisible: true },
  { id: 'otherQuantity', label: 'كمية الوحدة الأخرى', accessor: 'otherQuantity', format: 'number', defaultVisible: true },
  { id: 'averageCost', label: 'سعر التكلفة', accessor: 'averageCost', format: 'money', totalMode: 'none', defaultVisible: true },
  { id: 'stockValue', label: 'قيمة المخزون', accessor: 'stockValue', format: 'money', defaultVisible: true },
  { id: 'upperLimit', label: 'الحد الأعلى', accessor: 'upperLimit', format: 'number', totalMode: 'none', defaultVisible: true },
  { id: 'lowerLimit', label: 'الحد الأدنى', accessor: 'lowerLimit', format: 'number', totalMode: 'none', defaultVisible: true },
  { id: 'orderLimit', label: 'حد الطلب', accessor: 'orderLimit', format: 'number', totalMode: 'none', defaultVisible: true },
  { id: 'itemNature', label: 'طبيعة الصنف', accessor: 'itemNature', format: 'text', defaultVisible: true },
  { id: 'itemKind', label: 'نوع الصنف', accessor: 'itemKind', format: 'text', defaultVisible: true },
  { id: 'salesTaxPercent', label: 'نسبة ضريبة المبيعات', accessor: 'salesTaxPercent', format: 'number', totalMode: 'none', defaultVisible: true },
  { id: 'barcode', label: 'الباركود', accessor: 'barcode', format: 'text', detail: true, defaultVisible: true },
  { id: 'salePrice', label: 'السعر', accessor: 'salePrice', format: 'money', totalMode: 'none', detail: true, defaultVisible: true },
  { id: 'manufacturer', label: 'المصنع', accessor: 'manufacturer', format: 'text', detail: true, defaultVisible: true },
  { id: 'color', label: 'اللون', accessor: 'color', format: 'text', detail: true, defaultVisible: true },
  { id: 'origin', label: 'بلد المنشأ', accessor: 'origin', format: 'text', detail: true, defaultVisible: true },
  { id: 'quality', label: 'النوعية', accessor: 'quality', format: 'text', detail: true, defaultVisible: true },
  { id: 'size', label: 'المقاس', accessor: 'size', format: 'text', detail: true, defaultVisible: true },
  { id: 'property1', label: 'خاصية 1', accessor: 'property1', format: 'text', detail: true, defaultVisible: true },
  { id: 'property2', label: 'خاصية 2', accessor: 'property2', format: 'text', detail: true, defaultVisible: true },
  { id: 'property3', label: 'خاصية 3', accessor: 'property3', format: 'text', detail: true, defaultVisible: true },
  { id: 'property4', label: 'خاصية 4', accessor: 'property4', format: 'text', detail: true, defaultVisible: true },
  { id: 'property5', label: 'خاصية 5', accessor: 'property5', format: 'text', detail: true, defaultVisible: true },
];

export const STOCK_PROFIT_COLUMNS: ReportColumnDef[] = [
  { id: 'itemSerial', label: 'رقم الصنف', accessor: 'itemSerial', format: 'text', defaultVisible: true },
  { id: 'itemName', label: 'الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
  { id: 'groupName', label: 'المجموعة', accessor: 'groupName', format: 'text', defaultVisible: true },
  { id: 'unitName', label: 'الوحدة', accessor: 'unitName', format: 'text', defaultVisible: true },
  { id: 'warehouseName', label: 'المخزن', accessor: 'warehouseName', format: 'text', defaultVisible: true },
  { id: 'quantity', label: 'الكمية', accessor: 'quantity', format: 'number', defaultVisible: true },
  { id: 'salePrice', label: 'سعر البيع', accessor: 'salePrice', format: 'money', totalMode: 'none', defaultVisible: true },
  { id: 'saleValue', label: 'قيمة البيع', accessor: 'saleValue', format: 'money', defaultVisible: true },
  { id: 'unitCost', label: 'التكلفة', accessor: 'unitCost', format: 'money', totalMode: 'none', defaultVisible: true },
  { id: 'costValue', label: 'قيمة التكلفة', accessor: 'costValue', format: 'money', defaultVisible: true },
  { id: 'profit', label: 'الربح', accessor: 'profit', format: 'money', defaultVisible: true },
  { id: 'profitPercentOnSales', label: 'نسبة الربح إلى المبيعات', accessor: 'profitPercentOnSales', format: 'percent', totalMode: 'none', defaultVisible: true },
  { id: 'profitPercentOnCost', label: 'نسبة الربح إلى التكلفة', accessor: 'profitPercentOnCost', format: 'percent', totalMode: 'none', defaultVisible: true },
  { id: 'profitPercentOnTotal', label: 'نسبة الربح إلى الإجمالي', accessor: 'profitPercentOnTotal', format: 'percent', totalMode: 'none', defaultVisible: true },
];

export const INVOICES_PROFIT_COLUMNS: ReportColumnDef[] = [
  { id: 'invoiceNumber', label: 'رقم الفاتورة', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
  { id: 'invoicePattern', label: 'نوعها', accessor: 'invoicePattern', format: 'text', defaultVisible: true },
  { id: 'date', label: 'التاريخ', accessor: 'date', format: 'date', defaultVisible: true },
  { id: 'customer', label: 'العميل', accessor: 'customer', format: 'relation', defaultVisible: true },
  { id: 'totalSales', label: 'إجمالي المبيعات', accessor: 'totalSales', format: 'money', defaultVisible: true },
  { id: 'totalCost', label: 'إجمالي التكلفة', accessor: 'totalCost', format: 'money', defaultVisible: true },
  { id: 'additionsAmount', label: 'إضافات', accessor: 'additionsAmount', format: 'money', defaultVisible: true },
  { id: 'discountsAmount', label: 'خصومات', accessor: 'discountsAmount', format: 'money', defaultVisible: true },
  { id: 'netAdditionsAndDiscounts', label: 'صافي الإضافات والخصومات', accessor: 'netAdditionsAndDiscounts', format: 'money', defaultVisible: true },
  { id: 'profit', label: 'الربح', accessor: 'profit', format: 'money', defaultVisible: true },
  { id: 'profitPercentOnSales', label: 'نسبة الربح إلى المبيعات', accessor: 'profitPercentOnSales', format: 'percent', totalMode: 'none', defaultVisible: true },
  { id: 'profitPercentOnCost', label: 'نسبة الربح إلى التكلفة', accessor: 'profitPercentOnCost', format: 'percent', totalMode: 'none', defaultVisible: true },
  { id: 'profitPercentOnTotal', label: 'نسبة الربح إلى الإجمالي', accessor: 'profitPercentOnTotal', format: 'percent', totalMode: 'none', defaultVisible: true },
];

export const ITEMS_PROFIT_COLUMNS: ReportColumnDef[] = [
  { id: 'itemSerial', label: 'رقم الصنف', accessor: 'itemSerial', format: 'text', defaultVisible: true },
  { id: 'itemName', label: 'الصنف', accessor: 'itemName', format: 'text', defaultVisible: true },
  { id: 'unitName', label: 'الوحدة', accessor: 'unitName', format: 'text', defaultVisible: true },
  { id: 'quantity', label: 'إجمالي الكمية', accessor: 'quantity', format: 'number', defaultVisible: true },
  { id: 'totalSales', label: 'المبيعات', accessor: 'totalSales', format: 'money', defaultVisible: true },
  { id: 'totalCost', label: 'التكلفة', accessor: 'totalCost', format: 'money', defaultVisible: true },
  { id: 'totalProfit', label: 'الربح', accessor: 'totalProfit', format: 'money', defaultVisible: true },
  { id: 'profitPercentOnSales', label: 'نسبة الربح إلى المبيعات', accessor: 'profitPercentOnSales', format: 'percent', totalMode: 'none', defaultVisible: true },
  { id: 'profitPercentOnCost', label: 'نسبة الربح إلى التكلفة', accessor: 'profitPercentOnCost', format: 'percent', totalMode: 'none', defaultVisible: true },
  { id: 'profitPercentOnTotal', label: 'نسبة الربح إلى الإجمالي', accessor: 'profitPercentOnTotal', format: 'percent', totalMode: 'none', defaultVisible: true },
];

function debtAgeColumns(): ReportColumnDef[] {
  return [
    { id: 'invoiceDate', label: 'تاريخ الفاتورة', accessor: 'invoiceDate', format: 'date', defaultVisible: true },
    { id: 'documentType', label: 'نوعها', accessor: 'documentType', format: 'text', defaultVisible: true },
    { id: 'invoiceNumber', label: 'رقم الفاتورة', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
    { id: 'partyName', label: 'المورد أو العميل', accessor: 'partyName', format: 'text', defaultVisible: true },
    { id: 'invoiceTotal', label: 'إجمالي القيمة', accessor: 'invoiceTotal', format: 'money', defaultVisible: true },
    { id: 'lastPaymentDate', label: 'تاريخ آخر سداد', accessor: 'lastPaymentDate', format: 'date', defaultVisible: true },
    { id: 'paidAmount', label: 'إجمالي المسدد', accessor: 'paidAmount', format: 'money', defaultVisible: true },
    { id: 'remainingAmount', label: 'إجمالي المتبقي', accessor: 'remainingAmount', format: 'money', defaultVisible: true },
    { id: 'ageFromInvoice', label: 'عمر الدين بالنسبة للفاتورة', accessor: 'ageFromInvoice', format: 'number', totalMode: 'none', defaultVisible: true },
    { id: 'ageFromLastPayment', label: 'عمر الدين بالنسبة لآخر سداد', accessor: 'ageFromLastPayment', format: 'number', totalMode: 'none', defaultVisible: true },
  ];
}

export const DEBT_AGE_COLUMNS = debtAgeColumns();

const OVERDUE_PAYMENT_COLUMNS: ReportColumnDef[] = [
  { id: 'invoiceNumber', label: 'رقم الفاتورة', accessor: 'invoiceNumber', format: 'text', defaultVisible: true },
  { id: 'documentType', label: 'نوعها', accessor: 'documentType', format: 'text', defaultVisible: true },
  { id: 'invoiceDate', label: 'تاريخها', accessor: 'invoiceDate', format: 'date', defaultVisible: true },
  { id: 'partyName', label: 'اسم العميل أو المورد', accessor: 'partyName', format: 'text', defaultVisible: true },
  { id: 'invoiceTotal', label: 'قيمة الفاتورة', accessor: 'invoiceTotal', format: 'money', defaultVisible: true },
  { id: 'paymentAmount', label: 'قيمة الدفعة', accessor: 'paymentAmount', format: 'money', defaultVisible: true },
  { id: 'dueDate', label: 'تاريخ الاستحقاق', accessor: 'dueDate', format: 'date', defaultVisible: true },
  { id: 'settlementDate', label: 'تاريخ السداد', accessor: 'settlementDate', format: 'date', defaultVisible: true },
  { id: 'paymentMethod', label: 'طريقة السداد', accessor: 'paymentMethod', format: 'text', defaultVisible: true },
  { id: 'paidAmount', label: 'قيمة المسدد', accessor: 'paidAmount', format: 'money', defaultVisible: true },
  { id: 'remainingAmount', label: 'المتبقي', accessor: 'remainingAmount', format: 'money', defaultVisible: true },
  { id: 'paymentStatus', label: 'حالة السداد', accessor: 'paymentStatus', format: 'text', defaultVisible: true },
  { id: 'delayKind', label: 'حالة التأخير', accessor: 'delayKind', format: 'text', defaultVisible: true },
  { id: 'debtAge', label: 'عمر الدين', accessor: 'debtAge', format: 'number', totalMode: 'none', defaultVisible: true },
  { id: 'daysLate', label: 'أيام التأخير', accessor: 'daysLate', format: 'number', totalMode: 'none', defaultVisible: true },
  { id: 'penaltyRate', label: 'نسبة الغرامة', accessor: 'penaltyRate', format: 'number', totalMode: 'none', defaultVisible: true },
  { id: 'penaltyAmount', label: 'قيمة الغرامة', accessor: 'penaltyAmount', format: 'money', defaultVisible: true },
];

const REPORT_COLUMNS_BY_PATH: Record<string, ReportColumnDef[]> = {
  'inventory/reports/sales-reports': SALES_DOCUMENT_REPORT_COLUMNS,
  'inventory/reports/purchase-reports': PURCHASE_DOCUMENT_REPORT_COLUMNS,
  'inventory/reports/sales-and-purchase-tax': SALES_PURCHASE_TAX_COLUMNS,
  'inventory/reports/sales-returns-reports': SALES_RETURN_DOCUMENT_REPORT_COLUMNS,
  'inventory/reports/purchase-returns-reports': PURCHASE_RETURN_DOCUMENT_REPORT_COLUMNS,
  'inventory/reports/sales-and-returns-reports': SALES_WITH_RETURNS_REPORT_COLUMNS,
  'inventory/reports/customer-accounts-reports': CUSTOMER_ACCOUNT_COLUMNS,
  'inventory/reports/supplier-accounts-reports': SUPPLIER_ACCOUNT_COLUMNS,
  'inventory/reports/customer-balances': CUSTOMER_BALANCE_COLUMNS,
  'inventory/reports/collections-and-overdues': COLLECTIONS_AND_OVERDUES_COLUMNS,
  'inventory/reports/customer-receivables': CUSTOMER_RECEIVABLES_COLUMNS,
  'inventory/reports/invoices-profit-reports': INVOICES_PROFIT_COLUMNS,
  'inventory/reports/items-profit-reports': ITEMS_PROFIT_COLUMNS,
  'inventory/reports/stock-profit-reports': STOCK_PROFIT_COLUMNS,
  'inventory/reports/inventory-reports': INVENTORY_COUNT_COLUMNS,
  'inventory/reports/customer-accounts-currency-reports': CUSTOMER_CURRENCY_ACCOUNT_COLUMNS,
  'inventory/reports/supplier-accounts-currencies': SUPPLIER_CURRENCY_ACCOUNT_COLUMNS,
  'inventory/reports/customer-account-items': PARTY_ITEM_ACCOUNT_COLUMNS,
  'inventory/reports/supplier-account-items': PARTY_ITEM_ACCOUNT_COLUMNS,
  'inventory/reports/receivables-aging': DEBT_AGE_COLUMNS,
  'inventory/reports/overdue-payments': OVERDUE_PAYMENT_COLUMNS,
  'inventory/reports/item-movement-reports': ITEM_MOVEMENT_COLUMNS,
  'inventory/reports/expiry-date-report': EXPIRY_DATE_COLUMNS,
  'inventory/reports/monthly-sales-for-items': MONTHLY_ITEM_SALES_COLUMNS,
  'inventory/reports/analytical-invoices': ANALYTICAL_INVOICE_COLUMNS,
  'inventory/reports/item-movements': ITEM_MOVEMENT_COLUMNS,
  'inventory/reports/items-exceeding-order-limit': ITEMS_EXCEEDING_ORDER_LIMIT_COLUMNS,
  'inventory/reports/price-list': PRICE_LIST_COLUMNS,
  'pos/daily': POS_DAILY_REPORT_COLUMNS,
  'accounting/account-reports/credit/financial-papers': FINANCIAL_PAPERS_COLUMNS,
};

function guessFormat(key: string): ReportCellFormat {
  if (/date|At$/i.test(key) && key !== 'updatedAt') return key.endsWith('At') ? 'datetime' : 'date';
  if (/^(account|costCenter|customer|supplier|safe|bankAccount|branch)$/i.test(key)) {
    return 'relation';
  }
  // Name columns such as costCenterName contain "cost" and must stay text.
  // accountType contains "count", so it must be text before the number check.
  if (/(Name|Label|Path|Code|Status|Description|Account|Number|Type)$/i.test(key)) {
    return 'text';
  }
  if (
    /amount|total|price|cost|balance|paid|profit|tax|discount|net|debit|credit|budget|actual|variance|expenses/i.test(
      key
    )
  ) {
    return 'money';
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
  const costCenterLedger = registryPath.endsWith('books/cost-center-ledger');
  const ledgerFooter =
    costCenterLedger ||
    registryPath.endsWith('books/daftar-ostaz') ||
    registryPath.endsWith('books/general-ledger');
  const dailyJournalList =
    registryPath.endsWith('books/journal-book') || registryPath.endsWith('books/daily-journal');
  return keys.map((key) => ({
    id: key,
    label: costCenterLedger
      ? key === 'accountName'
        ? 'مركز التكلفة'
        : key === 'costCenterName'
          ? 'الحساب'
          : labelForAutoColumn(key)
      : labelForAutoColumn(key),
    accessor: key,
    format: key === 'exchangeRate' || key === 'entryExchangeRate' ? 'number' : guessFormat(key),
    defaultVisible: !TECHNICAL_COLUMN_IDS.has(key),
    technical: TECHNICAL_COLUMN_IDS.has(key),
    ...(ledgerFooter ? { totalMode: ledgerSheetTotalMode(key) } : {}),
    ...(dailyJournalList && (key === 'exchangeRate' || key === 'entryExchangeRate')
      ? { totalMode: 'none' as const }
      : {}),
    ...(key === 'accountType'
      ? {
          getValue: (row: Record<string, unknown>) => accountTypeLabel(row.accountType),
        }
      : {}),
    ...(key === 'sourceType'
      ? {
          getValue: (row: Record<string, unknown>) =>
            row.rowKind === 'total' || row.rowKind === 'opening' ? '' : journalSourceLabelFromRow(row),
        }
      : {}),
  }));
}

/** Ledger footer: debit, credit, and their difference. Opening counts; section totals do not. */
function ledgerSheetTotalMode(key: string): ReportColumnDef['totalMode'] {
  if (key === 'debitBase' || key === 'creditBase' || key === 'debit' || key === 'credit') return 'withOpening';
  if (key === 'runningBalance') return 'net';
  return 'none';
}

function footerAmount(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function sideAmount(row: Record<string, unknown>, baseKey: string, faceKey: string): number {
  if (baseKey in row && row[baseKey] != null && row[baseKey] !== '') return footerAmount(row[baseKey]);
  return footerAmount(row[faceKey]);
}

export function ledgerFooterFigures(rows: Record<string, unknown>[]): {
  debit: number;
  credit: number;
  balance: number;
} | null {
  let debit = 0;
  let credit = 0;
  let any = false;
  for (const row of rows) {
    if (row.rowKind === 'total' || row.isGroup === true) continue;
    any = true;
    debit += sideAmount(row, 'debitBase', 'debit');
    credit += sideAmount(row, 'creditBase', 'credit');
  }
  if (!any) return null;
  return { debit, credit, balance: debit - credit };
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
