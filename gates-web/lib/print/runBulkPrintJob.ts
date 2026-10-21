import { buildInvoicePrintModelFromApi } from '@/lib/print/buildInvoicePrintModel';
import { printInvoiceDocument, printOperationalDocument } from '@/lib/print/printOperationalDocument';
import type { CompanyPrintProfile } from '@/lib/print/types';

export type BulkPrintRenderItem =
  | { kind: 'invoice'; documentId: string; invoice: Record<string, unknown> }
  | {
      kind: 'operational';
      documentId: string;
      print: Parameters<typeof printOperationalDocument>[0];
    };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Opens the browser print dialog once per document (sequential). */
export async function runBulkPrintJob(
  items: BulkPrintRenderItem[],
  company: CompanyPrintProfile | undefined,
  onProgress?: (index: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    onProgress?.(i + 1, items.length);
    if (item.kind === 'invoice') {
      const model = buildInvoicePrintModelFromApi(item.invoice, company);
      if (model.lines.length > 0) {
        await printInvoiceDocument(model, company);
      }
    } else {
      await printOperationalDocument(item.print);
    }
    if (i < items.length - 1) {
      await sleep(700);
    }
  }
}
