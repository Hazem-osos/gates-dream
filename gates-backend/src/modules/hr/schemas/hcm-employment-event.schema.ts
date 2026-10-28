import { z } from 'zod';

export const createEmploymentEventSchema = z.object({
  employmentId: z.string().uuid('معرّف التوظيف غير صالح'),
  eventType: z.string().trim().min(1, 'نوع الإجراء مطلوب').max(40),
  effectiveDate: z.coerce.date(),
  payload: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().max(500).nullish().transform((v) => v ?? undefined),
  notes: z.string().max(2000).nullish().transform((v) => v ?? undefined),
});

export const rejectEmploymentEventSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CreateEmploymentEventInput = z.infer<typeof createEmploymentEventSchema>;
