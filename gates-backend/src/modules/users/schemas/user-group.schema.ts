import { z } from 'zod';

export const createUserGroupSchema = z.object({
  companyId: z.string().uuid('Company ID must be a valid UUID'),
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  password: z.string().optional(),
  priceList: z.string().optional(),
  hidePricesInInvoices: z.boolean().optional(),
  allowChangePaymentValue: z.boolean().optional(),
  posManager: z.boolean().optional(),
  deactivate: z.boolean().optional(),
  studentAffairs: z.boolean().optional(),
  busManager: z.boolean().optional(),
  studentAccounts: z.boolean().optional(),
});

export const updateUserGroupSchema = createUserGroupSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const addUserToGroupSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
});

export const userGroupQuerySchema = z.object({
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

export type CreateUserGroupInput = z.infer<typeof createUserGroupSchema>;
export type UpdateUserGroupInput = z.infer<typeof updateUserGroupSchema>;
export type AddUserToGroupInput = z.infer<typeof addUserToGroupSchema>;
export type UserGroupQueryInput = z.infer<typeof userGroupQuerySchema>;

