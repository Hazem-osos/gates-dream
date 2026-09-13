'use client';

import { ElectronicInvoiceReportFilterPage } from '@/components/electronic-invoices/ElectronicInvoiceReportFilterPage';

export default function SalesInvoicesReportPage() {
  return (
    <ElectronicInvoiceReportFilterPage
      urlPath="/electronic-invoices/reports/sales-invoices"
      apiPath="/electronic-invoices/reports/sales-invoices"
      previewPath="/electronic-invoices/reports/sales-invoices/preview"
      titleHint="فواتير المبيعات الإلكترونية ضمن الفترة المحددة."
      queryKey="e-invoice-sales-report"
      tableId="e-invoice-sales-report-table"
      exportFileBase="e-invoice-sales-report"
    />
  );
}
