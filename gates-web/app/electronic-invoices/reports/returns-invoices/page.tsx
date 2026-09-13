'use client';

import { ElectronicInvoiceReportFilterPage } from '@/components/electronic-invoices/ElectronicInvoiceReportFilterPage';

export default function ReturnsInvoicesReportPage() {
  return (
    <ElectronicInvoiceReportFilterPage
      urlPath="/electronic-invoices/reports/returns-invoices"
      apiPath="/electronic-invoices/reports/returns-invoices"
      previewPath="/electronic-invoices/reports/returns-invoices/preview"
      titleHint="مرتجعات الفواتير الإلكترونية ضمن الفترة المحددة."
      queryKey="e-invoice-returns-report"
      tableId="e-invoice-returns-report-table"
      exportFileBase="e-invoice-returns-report"
    />
  );
}
