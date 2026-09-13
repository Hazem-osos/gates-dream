import { z } from 'zod';

export const createUserSchema = z.object({
  companyId: z.string().uuid('Company ID must be a valid UUID'),
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters')
    .optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(100, 'New password must be at most 100 characters'),
});

const avatarUrlField = z
  .string()
  .max(3_000_000, 'Avatar image is too large')
  .optional()
  .nullable()
  .refine(
    (v) =>
      v == null ||
      v === '' ||
      v.startsWith('data:image/') ||
      v.startsWith('/') ||
      /^https?:\/\//i.test(v),
    'Avatar must be a data URL, path, or http(s) URL'
  );

const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().email('Invalid email address').optional()
);

const optionalPhone = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().max(50).optional().nullable()
);

export const updateSelfProfileSchema = z.object({
  email: optionalEmail,
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  phone: optionalPhone,
  preferredLanguage: z.enum(['ar', 'en']).optional(),
  avatarUrl: avatarUrlField,
});

export const userQuerySchema = z.object({
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

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateSelfProfileInput = z.infer<typeof updateSelfProfileSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
