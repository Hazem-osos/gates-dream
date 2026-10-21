import { printStockDocument } from '@/lib/print/printStockDocument';

export function maybePrintStockDocumentAfterSave(
  enabled: boolean,
  input: {
    title: string;
    number?: string;
    date?: string;
    subtitle?: string;
    rows: Array<{ item?: string; quantity?: number; price?: number }>;
  }
) {
  if (!enabled) return;
  printStockDocument(input);
}
