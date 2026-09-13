export type PdfDocumentKind = 'invoice' | 'receipt' | 'report';

export type PdfGenerationJobData = {
  companyId: string;
  userId: string;
  kind: PdfDocumentKind;
  invoiceId?: string;
  posOrderId?: string;
  reportName?: string;
  filters?: Record<string, unknown>;
  email?: string;
};

export type TaxPortalJobKind =
  | 'eta-submit-invoice'
  | 'eta-submit-receipt'
  | 'eta-submit-batch'
  | 'eta-poll-status'
  | 'form41-export';

export type TaxPortalSyncJobData = {
  companyId: string;
  userId: string;
  kind: TaxPortalJobKind;
  invoiceId?: string;
  invoiceIds?: string[];
  posOrderId?: string;
  documentUuid?: string;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  format?: 'CSV' | 'EXCEL';
};

export type ReportExportJobData = {
  companyId: string;
  userId: string;
  reportType: 'excel' | 'csv' | 'pdf';
  reportName: string;
  filters: Record<string, unknown>;
  email?: string;
};

export type JobArtifactResult = {
  success: true;
  companyId: string;
  fileName: string;
  filePath: string;
  downloadUrl: string;
  mimeType: string;
};
