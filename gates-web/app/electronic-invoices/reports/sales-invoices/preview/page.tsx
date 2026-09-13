'use client';

import ElectronicInvoiceReportPreviewPage from '@/components/electronic-invoices/ElectronicInvoiceReportPreviewPage';

export default function SalesInvoicesReportPreviewRoute() {
  return (
    <ElectronicInvoiceReportPreviewPage
      reportKind="sales-invoices"
      title="معاينة — فواتير المبيعات الإلكترونية"
    />
  );
}
