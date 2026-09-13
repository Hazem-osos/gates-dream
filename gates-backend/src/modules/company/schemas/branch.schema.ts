import { z } from 'zod';

export const createBranchSchema = z.object({
  companyId: z.string().uuid('Company ID must be a valid UUID'),
  serial: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  branchNumber: z.string().optional(),
  activationNumber: z.string().optional(),
  priceList: z.string().optional(),
  registrationNumber: z.string().optional(),
  barcodePrice: z.string().optional(),
  governorate: z.string().optional(),
  district: z.string().optional(),
  streetName: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  buildingNumber: z.string().optional(),
  postalCode: z.string().optional(),
  address: z.string().optional(),
});

export const updateBranchSchema = createBranchSchema.partial().omit({
  companyId: true, // Company ID cannot be changed
});

export const branchQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type BranchQueryInput = z.infer<typeof branchQuerySchema>;

