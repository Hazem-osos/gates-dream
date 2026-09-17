import { z } from 'zod';

export const documentEditLeaseBodySchema = z.object({
  resourceKey: z.string().trim().min(3).max(300),
  sessionId: z.string().trim().min(8).max(80),
  userName: z.string().trim().max(80).optional(),
});
