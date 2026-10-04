import { z } from 'zod';

export const reverseContractingCertificateSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  reason: z.string().trim().min(3).max(2000),
  reversalDate: z.coerce.date().optional(),
});

export type ReverseContractingCertificateInput = z.infer<typeof reverseContractingCertificateSchema>;
