export type InvoiceAllocationInput = { invoiceId: string; allocatedAmount: number };

export function normalizeInvoiceAllocations(value: unknown): InvoiceAllocationInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const invoiceId =
        row && typeof row === 'object' && typeof (row as { invoiceId?: unknown }).invoiceId === 'string'
          ? (row as { invoiceId: string }).invoiceId
          : '';
      const allocatedAmount = Number(
        row && typeof row === 'object' ? (row as { allocatedAmount?: unknown }).allocatedAmount : NaN
      );
      return { invoiceId, allocatedAmount };
    })
    .filter((row) => row.invoiceId && Number.isFinite(row.allocatedAmount) && row.allocatedAmount > 0);
}
