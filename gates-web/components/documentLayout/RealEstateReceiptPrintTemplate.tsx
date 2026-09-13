'use client';

import type { DocumentLayoutConfig } from '@/lib/documentLayout/types';
import type { RealEstateReceiptMock } from '@/lib/documentLayout/mockData';
import { PrintDocumentRenderer } from './PrintDocumentRenderer';

export function RealEstateReceiptPrintTemplate({
  data,
  config,
  qrDataUrl,
}: {
  data: RealEstateReceiptMock;
  config: DocumentLayoutConfig;
  qrDataUrl?: string | null;
}) {
  return <PrintDocumentRenderer data={data} config={config} qrDataUrl={qrDataUrl} />;
}
