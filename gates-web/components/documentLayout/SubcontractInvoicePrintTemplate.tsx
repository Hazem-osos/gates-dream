'use client';

import type { DocumentLayoutConfig } from '@/lib/documentLayout/types';
import type { ContractorInvoiceMock } from '@/lib/documentLayout/mockData';
import { PrintDocumentRenderer } from './PrintDocumentRenderer';

export function SubcontractInvoicePrintTemplate({
  data,
  config,
  qrDataUrl,
}: {
  data: ContractorInvoiceMock;
  config: DocumentLayoutConfig;
  qrDataUrl?: string | null;
}) {
  return <PrintDocumentRenderer data={data} config={config} qrDataUrl={qrDataUrl} />;
}
