'use client';

import type { DocumentLayoutConfig } from '@/lib/documentLayout/types';
import type { TaxInvoiceMock } from '@/lib/documentLayout/mockData';
import { PrintDocumentRenderer } from './PrintDocumentRenderer';

export function DebitNotePrintTemplate({
  data,
  config,
  qrDataUrl,
}: {
  data: TaxInvoiceMock;
  config: DocumentLayoutConfig;
  qrDataUrl?: string | null;
}) {
  return <PrintDocumentRenderer data={data} config={config} qrDataUrl={qrDataUrl} />;
}
