import { z } from 'zod';

/** Persisted under company_settings.advanced_settings.schoolSettings */
export const schoolSettingsSchema = z
  .object({
    createEntryOnStudentSave: z.boolean().optional(),
    allowEarlyDiscount: z.boolean().optional(),
    comparisonMonth: z.string().optional(),
    comparisonDay: z.string().optional(),
    allowRegistration: z.boolean().optional(),
    allowPaymentValueChange: z.boolean().optional(),
    educationRevenue: z.string().optional(),
    booksRevenue: z.string().optional(),
    activityRevenue: z.string().optional(),
    carRevenue: z.string().optional(),
    otherRevenue: z.string().optional(),
    discountedAccruedRevenue: z.string().optional(),
    students: z.string().optional(),
    year: z.string().optional(),
    projectSupportFundRatios: z.string().optional(),
    privateSchoolObligations: z.string().optional(),
    schoolOwnersAssociation: z.string().optional(),
    bankMisrSupportFund: z.string().optional(),
    advanceEducation: z.string().optional(),
    advanceBooks: z.string().optional(),
    advanceActivity: z.string().optional(),
    advanceCar: z.string().optional(),
    advanceOther: z.string().optional(),
  })
  .strict();

export type SchoolSettingsInput = z.infer<typeof schoolSettingsSchema>;
