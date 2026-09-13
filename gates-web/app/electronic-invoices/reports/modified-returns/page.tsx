'use client';

import { ElectronicInvoiceReportFilterPage } from '@/components/electronic-invoices/ElectronicInvoiceReportFilterPage';

export default function ModifiedReturnsReportPage() {
  return (
    <ElectronicInvoiceReportFilterPage
      urlPath="/electronic-invoices/reports/modified-returns"
      apiPath="/electronic-invoices/reports/modified-returns"
      previewPath="/electronic-invoices/reports/modified-returns/preview"
      titleHint="المرتجعات المعدّلة الإلكترونية ضمن الفترة المحددة."
      queryKey="e-invoice-modified-returns-report"
      tableId="e-invoice-modified-returns-report-table"
      exportFileBase="e-invoice-modified-returns-report"
    />
  );
}
