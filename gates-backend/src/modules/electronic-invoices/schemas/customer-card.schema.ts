import { z } from 'zod';

export const createElectronicInvoiceCustomerSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  taxNumber: z.string().min(1, 'Tax number is required'),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  commercialRegistration: z.string().optional().nullable(),
});

export const updateElectronicInvoiceCustomerSchema = createElectronicInvoiceCustomerSchema.partial();

export const electronicInvoiceCustomerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

