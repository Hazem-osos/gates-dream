'use client';

import ElectronicInvoiceReportPreviewPage from '@/components/electronic-invoices/ElectronicInvoiceReportPreviewPage';

export default function ModifiedReturnsReportPreviewRoute() {
  return (
    <ElectronicInvoiceReportPreviewPage
      reportKind="modified-returns"
      title="معاينة — المرتجعات المعدلة ولم ترسل"
    />
  );
}
