import { storeAiTransactionDraft } from '@/lib/ai/ai-draft-storage';

export const ASSEMBLY_SALES_INVOICE_DRAFT_TYPE = 'ASSEMBLY_SALES_INVOICE';

export type AssemblySalesInvoiceDraftInput = {
  warehouseId: string;
  description?: string;
  assemblySerial?: string | null;
  lines: Array<{
    itemId: string;
    itemName?: string;
    quantity: number;
    unitId?: string;
  }>;
};

export function storeAssemblySalesInvoiceDraft(input: AssemblySalesInvoiceDraftInput): void {
  storeAiTransactionDraft({
    actionType: ASSEMBLY_SALES_INVOICE_DRAFT_TYPE,
    titleAr: 'فاتورة مبيعات — صنف مجمع',
    draftPayload: {
      warehouseId: input.warehouseId,
      description: input.description ?? '',
      syncPricesOnCustomer: true,
      lines: input.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName ?? '',
        quantity: line.quantity,
        unitId: line.unitId,
        unitPrice: 0,
      })),
    },
  });
}

export function assemblySalesInvoiceDraftHref(): string {
  return '/inventory/operations/sales-invoice?fromAssemblyDraft=1';
}
