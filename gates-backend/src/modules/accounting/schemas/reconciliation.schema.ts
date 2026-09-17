import { z } from 'zod';

export const reconcileAllocationLineSchema = z.object({
  invoiceId: z.string().uuid(),
  allocatedAmount: z.number().positive(),
});

export const manualReconcileSchema = z.object({
  cashTransactionId: z.string().uuid(),
  allocations: z.array(reconcileAllocationLineSchema).min(1),
});

export const autoFifoReconcileSchema = z.object({
  cashTransactionId: z.string().uuid(),
});

export const openInvoicesQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  side: z.enum(['receivable', 'payable']).optional(),
});

export type ManualReconcileInput = z.infer<typeof manualReconcileSchema>;
export type AutoFifoReconcileInput = z.infer<typeof autoFifoReconcileSchema>;
