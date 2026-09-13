import { z } from 'zod';

export const copyCompanyDataSchema = z.object({
  fromCompanyId: z.string().uuid('From company ID must be a valid UUID'),
  toCompanyId: z.string().uuid('To company ID must be a valid UUID'),
  chartOfAccounts: z.boolean().optional(),
  costCenters: z.boolean().optional(),
  customers: z.boolean().optional(),
  suppliers: z.boolean().optional(),
  delegates: z.boolean().optional(),
  currencies: z.boolean().optional(),
  periods: z.boolean().optional(),
  items: z.boolean().optional(),
  units: z.boolean().optional(),
  warehouses: z.boolean().optional(),
  priceLists: z.boolean().optional(),
  employees: z.boolean().optional(),
  lookupTables: z.boolean().optional(),
}).refine(
  (data) => data.fromCompanyId !== data.toCompanyId,
  {
    message: 'Source and target companies cannot be the same',
    path: ['toCompanyId'],
  }
).refine(
  (data) => {
    // At least one option must be selected
    return Object.values(data).some((val) => typeof val === 'boolean' && val === true);
  },
  {
    message: 'At least one data type must be selected for copying',
  }
);

export type CopyCompanyDataInput = z.infer<typeof copyCompanyDataSchema>;

