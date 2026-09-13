import { z } from 'zod';

/** Payload persisted under company_settings.advanced_settings.hrPayroll */
export const hrPayrollSettingsSchema = z
  .object({
    treasury: z.string().optional(),
    accountCode: z.string().optional(),
    payrollAccount: z.string().optional(),
    insuranceAccount: z.string().optional(),
    insuranceExpense: z.string().optional(),
    workTaxAccount: z.string().optional(),
    vacationDueAccount: z.string().optional(),
    vacationAccruedAccount: z.string().optional(),
    endServiceAccount: z.string().optional(),
    endServiceAccruedAccount: z.string().optional(),
    houseAllowanceAccount: z.string().optional(),
    houseAllowanceAccruedAccount: z.string().optional(),
    fundAccount: z.string().optional(),
    bankAccount: z.string().optional(),
    warnBeforeDayEnd: z.string().optional(),
    warnBeforePassportEnd: z.string().optional(),
    warnBeforeInsuranceEnd: z.string().optional(),
    daysInMonth: z.string().optional(),
    hoursInDay: z.string().optional(),
    daysInYear: z.string().optional(),
    currency: z.string().optional(),
    fx1: z.string().optional(),
    fx2: z.string().optional(),
    fx3: z.string().optional(),
    termIn: z.string().optional(),
    termOut: z.string().optional(),
    preShiftMinutes: z.string().optional(),
  })
  .strict();

export type HrPayrollSettingsInput = z.infer<typeof hrPayrollSettingsSchema>;
