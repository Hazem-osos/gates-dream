import { z } from 'zod';

export const setCompanySettingSchema = z.object({
  value: z.string().max(4000),
  branchId: z.string().uuid().nullable().optional(),
});

export const listCompanySettingsQuerySchema = z.object({
  prefix: z.string().max(100).optional(),
  branchId: z.string().uuid().optional(),
});

export const catalogCompanySettingsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  moduleCode: z.string().min(2).max(8).optional(),
});
