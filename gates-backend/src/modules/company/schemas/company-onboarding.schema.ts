import { z } from 'zod';

export const onboardingSetupSchema = z.object({
  company: z.object({
    nameAr: z.string().min(1).max(255),
    nameEn: z.string().max(255).optional().nullable(),
    taxRegistrationNumber: z.string().max(100).optional().nullable(),
    commercialRegister: z.string().max(100).optional().nullable(),
    activityCode: z.string().max(50).optional().nullable(),
    currencyCode: z.string().min(3).max(10),
    logoUrl: z.string().max(500_000).optional().nullable(),
  }),
  fiscalYear: z.object({
    name: z.string().min(1).max(100),
    legacyYearId: z.string().max(20).optional(),
    startDate: z.string().min(4),
    endDate: z.string().min(4),
  }),
  branch: z.object({
    arabicName: z.string().min(1).max(255),
    branchNumber: z.string().max(20).optional().nullable(),
  }),
  treasury: z.object({
    safeArabicName: z.string().min(1).max(255),
    safeCode: z.string().max(30).optional().nullable(),
    cashGlAccountCode: z.string().max(20).default('1000'),
  }),
  warehouse: z.object({
    arabicName: z.string().min(1).max(255),
    code: z.string().min(1).max(30),
  }),
  seedStandardCoa: z.boolean().optional().default(true),
  industryTemplate: z
    .enum(['TRADE', 'RETAIL', 'CONTRACTING', 'MANUFACTURING', 'IMPORT_EXPORT', 'SERVICES'])
    .optional(),
});

export type OnboardingSetupInput = z.infer<typeof onboardingSetupSchema>;
