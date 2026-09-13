import { z } from 'zod';

export const createCompanySchema = z.object({
  serial: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  entityType: z.string().optional(),
  entityTypeCode: z.string().optional(),
  entityNumber: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
  address: z.string().optional(),
  taxNumber1: z.string().optional(),
  taxNumber2: z.string().optional(),
  taxNumber3: z.string().optional(),
});

export const updateCompanySchema = createCompanySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const companyQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CompanyQueryInput = z.infer<typeof companyQuerySchema>;

