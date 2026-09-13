import { z } from 'zod';

export const updateCompanyCurrentSchema = z.object({
  nameAr: z.string().min(1).max(255).optional(),
  nameEn: z.string().max(255).optional().nullable(),
  taxRegistrationNumber: z.string().max(100).optional().nullable(),
  commercialRegister: z.string().max(100).optional().nullable(),
  activityCode: z.string().max(50).optional().nullable(),
  currencyCode: z.string().max(10).optional().nullable(),
  logoUrl: z.string().max(500_000).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  eInvoiceSettings: z
    .object({
      clientId: z.string().max(255).optional().nullable(),
      clientSecret: z.string().max(2000).optional().nullable(),
      activityCode: z.string().max(50).optional().nullable(),
      tokenPin: z.string().max(100).optional().nullable(),
      environment: z.string().max(30).optional(),
      issuerTaxId: z.string().max(50).optional().nullable(),
    })
    .optional(),
});

export const upsertTenantBranchSchema = z.object({
  id: z.string().uuid().optional(),
  arabicName: z.string().min(1).max(255),
  branchNumber: z.string().max(50).optional().nullable(),
  serial: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  defaultWarehouseId: z.string().uuid().optional().nullable(),
  defaultSafeId: z.string().uuid().optional().nullable(),
});

export type UpdateCompanyCurrentInput = z.infer<typeof updateCompanyCurrentSchema>;
export type UpsertTenantBranchInput = z.infer<typeof upsertTenantBranchSchema>;
