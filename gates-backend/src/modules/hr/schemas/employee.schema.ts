import { z } from 'zod';

export const createEmployeeSchema = z.object({
  serial: z.string().optional(),
  employeeId: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  userId: z.string().uuid().optional().nullable(),
  gender: z.enum(['ذكر', 'أنثى']).optional(),
  nationalityId: z.string().uuid().optional().nullable(),
  religionId: z.string().uuid().optional().nullable(),
  maritalStatusId: z.string().uuid().optional().nullable(),
  birthDate: z.string().datetime().optional().nullable().or(z.date().nullable()),
  academicQualification: z.string().optional(),
  specialization: z.string().optional(),
  university: z.string().optional(),
  passportNumber: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  socialInsurance: z.string().optional(),
  /** Master data: employment & compensation (stored on Employee). */
  joinDate: z.string().min(1, 'تاريخ الالتحاق مطلوب'),
  basicSalary: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({
        required_error: 'الراتب الأساسي مطلوب',
        invalid_type_error: 'الراتب الأساسي مطلوب',
      })
      .positive('الراتب الأساسي يجب أن يكون أكبر من صفر')
  ),
  departmentId: z.string().uuid({ message: 'يجب اختيار القسم' }),
  advanceAccountId: z.string().uuid().optional().nullable(),
  // Identity Document Fields
  fingerprintNumber: z.string().optional(),
  identityNumber: z.string().trim().min(8, 'رقم الهوية مطلوب'),
  identityIssueDate: z.string().datetime().optional().nullable().or(z.date().nullable()),
  identityIssueDateHijri: z.string().optional(),
  identityExpiryDate: z.string().datetime().optional().nullable().or(z.date().nullable()),
  identityExpiryDateHijri: z.string().optional(),
  // Passport Fields
  passportIssueDate: z.string().datetime().optional().nullable().or(z.date().nullable()),
  passportIssueDateHijri: z.string().optional(),
  passportExpiryDate: z.string().datetime().optional().nullable().or(z.date().nullable()),
  passportExpiryDateHijri: z.string().optional(),
  // Graduation Date
  graduationDate: z.string().datetime().optional().nullable().or(z.date().nullable()),
  graduationDateHijri: z.string().optional(),
  // Insurance Dates
  insuranceIssueDate: z.string().datetime().optional().nullable().or(z.date().nullable()),
  insuranceIssueDateHijri: z.string().optional(),
  insuranceExpiryDate: z.string().datetime().optional().nullable().or(z.date().nullable()),
  insuranceExpiryDateHijri: z.string().optional(),
  // Contact Information
  mobile: z.string().optional(),
  homePhone: z.string().optional(),
  workPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const employeeQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional().nullable(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;
