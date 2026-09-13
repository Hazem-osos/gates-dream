'use client';

import ElectronicInvoiceReportPreviewPage from '@/components/electronic-invoices/ElectronicInvoiceReportPreviewPage';

export default function ReturnsInvoicesReportPreviewRoute() {
  return (
    <ElectronicInvoiceReportPreviewPage
      reportKind="returns-invoices"
      title="معاينة — فواتير المرتجعات الإلكترونية"
    />
  );
}
