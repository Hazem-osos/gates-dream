import { z } from 'zod';
import {
  LICENSE_MODULE_CODES,
  SUBSCRIPTION_PLAN_TYPES,
  SUBSCRIPTION_STATUSES,
} from '../../platform/types/license-modules';

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const password = z.string().min(8, 'كلمة المرور 8 أحرف على الأقل').max(128);

export const idParamSchema = z.object({ id: z.string().min(1).max(64) });

export const loginSchema = z.object({
  email: z.string().trim().email('بريد إلكتروني غير صالح').max(191),
  password: z.string().min(1).max(128),
});

export const companyListQuerySchema = z.object({
  page,
  pageSize,
  search: optionalText(100),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  license: z.enum(['all', 'unlicensed', 'active', 'trial', 'suspended', 'expired', 'expiring']).default('all'),
});

export const licenseSchema = z.object({
  planType: z.enum(SUBSCRIPTION_PLAN_TYPES),
  status: z.enum(SUBSCRIPTION_STATUSES).default('ACTIVE'),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date().nullable().optional(),
  allowedModules: z.array(z.enum(LICENSE_MODULE_CODES)).min(1, 'اختر موديول واحد على الأقل'),
  maxUsers: z.number().int().min(1).max(100000).default(5),
  maxBranches: z.number().int().min(1).max(10000).default(1),
  maxStorageMb: z.number().int().min(1).max(10_000_000).default(512),
});

export const licenseStatusSchema = z.object({ status: z.enum(SUBSCRIPTION_STATUSES) });

export const companyUpdateSchema = z
  .object({
    arabicName: z.string().trim().min(1).max(191).optional(),
    englishName: nullableText(191),
    contactEmail: z.string().trim().email().max(191).nullable().optional(),
    phone1: nullableText(50),
    address: nullableText(500),
    taxNumber1: nullableText(50),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'لا توجد تعديلات');

export const companyAiSchema = z
  .object({
    enabled: z.boolean().optional(),
    monthlyTokenLimit: z.number().int().min(0).max(1_000_000_000).optional(),
    resetUsage: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'لا توجد تعديلات');

const newUserFields = {
  email: z.string().trim().email('بريد إلكتروني غير صالح').max(191),
  username: z.string().trim().min(3).max(100),
  password,
  firstName: optionalText(100),
  lastName: optionalText(100),
};

export const companyCreateSchema = z.object({
  arabicName: z.string().trim().min(1).max(191),
  englishName: optionalText(191),
  contactEmail: z.string().trim().email().max(191).optional(),
  phone1: optionalText(50),
  admin: z.object(newUserFields),
  license: licenseSchema.optional(),
});

export const userListQuerySchema = z.object({
  page,
  pageSize,
  search: optionalText(100),
  companyId: z.string().max(64).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});

export const userCreateSchema = z.object({
  companyId: z.string().min(1).max(64),
  ...newUserFields,
  phone: optionalText(50),
  isAdmin: z.boolean().default(false),
});

export const userUpdateSchema = z
  .object({
    email: z.string().trim().email().max(191).optional(),
    username: z.string().trim().min(3).max(100).optional(),
    firstName: nullableText(100),
    lastName: nullableText(100),
    phone: nullableText(50),
    isActive: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'لا توجد تعديلات');

export const resetPasswordSchema = z.object({ password });

export const settingsUpdateSchema = z
  .object({
    aiEnabled: z.boolean().optional(),
    maintenance: z.object({ enabled: z.boolean(), message: optionalText(500) }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'لا توجد تعديلات');

export const auditQuerySchema = z.object({
  page,
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  action: optionalText(80),
  companyId: z.string().max(64).optional(),
  targetId: z.string().max(64).optional(),
});

export const adminCreateSchema = z.object({
  email: z.string().trim().email().max(191),
  name: optionalText(120),
  password,
});

export const adminActiveSchema = z.object({ isActive: z.boolean() });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});
