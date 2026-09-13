import { z } from 'zod';

export const partyQuickSummaryParamsSchema = z.object({
  id: z.string().uuid(),
});

export const partyQuickSummaryQuerySchema = z.object({
  partyType: z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
});
