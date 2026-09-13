export type OcrInvoiceLine = {
  rawItemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type OcrInvoiceExtraction = {
  supplierName: string;
  supplierTaxNumber?: string;
  invoiceNumber?: string;
  date?: string;
  lines: OcrInvoiceLine[];
  totalAmount: number;
  taxAmount: number;
  source: 'vision' | 'pdf-text';
};

export type ResolvedOcrSupplier = {
  id?: string;
  name: string;
  taxNumber?: string;
  confidence: number;
  matched: boolean;
};

export type ResolvedOcrLine = {
  rawItemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  itemId?: string;
  itemName: string;
  unitId?: string;
  conversionFactor: number;
  taxPercent: number;
  matchConfidence: number;
  needsCreation: boolean;
};

export type ResolvedOcrInvoice = {
  extraction: OcrInvoiceExtraction;
  supplier: ResolvedOcrSupplier;
  warehouse?: { id: string; arabicName: string };
  lines: ResolvedOcrLine[];
};
