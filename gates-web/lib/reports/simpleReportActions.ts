'use client';

import { exportTableToExcel, printElementById, type ExportColumnDef } from '@/lib/export/export-utils';

export const EXTRACT_REPORT_TABLE_ID = 'extract-report-table';

export const EXTRACT_PAYMENT_TABLE_ID = 'extract-payment-table';

export function printExtractPaymentReport(title: string): void {
  printElementById(EXTRACT_PAYMENT_TABLE_ID, title);
}

export function printExtractReport(title: string): void {
  printElementById(EXTRACT_REPORT_TABLE_ID, title);
}

export async function exportExtractReportRows<T extends Record<string, unknown>>(
  fileName: string,
  columns: ExportColumnDef<T>[],
  data: T[]
): Promise<void> {
  if (!data.length) return;
  await exportTableToExcel(fileName, columns, data, 'Report');
}

export const EXTRACT_PAYMENT_EXPORT_COLUMNS: ExportColumnDef<Record<string, unknown>>[] = [
  {
    id: 'extract',
    header: 'المستخلص',
    getValue: (r) => (r.extract as { extractNumber?: string })?.extractNumber ?? '—',
  },
  {
    id: 'contractorSerial',
    header: 'المقاول',
    getValue: (r) => (r.contractor as { serial?: string })?.serial ?? '—',
  },
  {
    id: 'contractorName',
    header: 'إسم المقاول',
    getValue: (r) => (r.contractor as { arabicName?: string })?.arabicName ?? '—',
  },
  { id: 'amount', header: 'القيمة', getValue: (r) => r.paymentAmount ?? 0, numeric: true },
  { id: 'itemGroup', header: 'مجموعة البند', getValue: (r) => r.itemGroup ?? '—' },
  { id: 'notes', header: 'ملاحظات', getValue: (r) => r.notes ?? r.description ?? '—' },
];

export const PROJECTS_STATUS_EXPORT_COLUMNS: ExportColumnDef<Record<string, unknown>>[] = [
  { id: 'contractor', header: 'مقاول', getValue: (r) => (r.contractor as { arabicName?: string })?.arabicName ?? '—' },
  { id: 'project', header: 'مشروع', getValue: (r) => (r.project as { arabicName?: string })?.arabicName ?? '—' },
  { id: 'extract', header: 'مستخلص', getValue: (r) => (r.extract as { extractNumber?: string })?.extractNumber ?? '—' },
  {
    id: 'date',
    header: 'تاريخ',
    getValue: (r) =>
      r.paymentDate ? new Date(String(r.paymentDate)).toLocaleDateString('ar-EG') : '—',
  },
  { id: 'amount', header: 'المبلغ', getValue: (r) => r.paymentAmount ?? 0, numeric: true },
];

export const E_INVOICE_REPORT_TABLE_ID = 'e-invoice-report-table';

export const E_INVOICE_EXPORT_COLUMNS: ExportColumnDef<Record<string, unknown>>[] = [
  { id: 'invoiceNumber', header: 'رقم الفاتورة', getValue: (r) => r.invoiceNumber ?? '—' },
  { id: 'clientCode', header: 'الرقم الضريبي / كود العميل', getValue: (r) => r.clientCode ?? '—' },
  { id: 'clientName', header: 'إسم العميل', getValue: (r) => r.clientName ?? '—' },
  { id: 'invoiceDate', header: 'تاريخ الفاتورة', getValue: (r) => r.invoiceDate ?? '—' },
  { id: 'value', header: 'القيمة', getValue: (r) => r.value ?? '—' },
  { id: 'status', header: 'الحالة', getValue: (r) => r.status ?? '—' },
  { id: 'submissionDate', header: 'تاريخ الإرسال', getValue: (r) => r.submissionDate ?? '—' },
];

export function printEInvoiceReport(title: string): void {
  printElementById(E_INVOICE_REPORT_TABLE_ID, title);
}

export async function exportEInvoiceReportRows(
  fileName: string,
  data: Record<string, unknown>[]
): Promise<void> {
  if (!data.length) return;
  await exportTableToExcel(fileName, E_INVOICE_EXPORT_COLUMNS, data, 'Report');
}
