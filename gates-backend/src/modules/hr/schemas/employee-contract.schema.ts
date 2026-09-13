import { z } from 'zod';

const employeeContractFieldsSchema = z.object({
  employeeId: z.string().uuid('Employee ID must be a valid UUID'),
  serial: z.string().optional(),
  contractStartDate: z.coerce.date(),
  contractStartDateHijri: z.string().optional(),
  contractEndDate: z.coerce.date().optional().nullable(),
  contractEndDateHijri: z.string().optional(),
  wagePolicyId: z.string().uuid().optional().nullable(),
  basicSalary: z.number().nonnegative().optional().nullable(),
  insuranceSalary: z.number().nonnegative().optional().nullable(),
  insurancePercentage: z.number().min(0).max(100).optional().nullable(),
  paymentMethod: z.enum(['fund', 'bank']).optional().nullable(),
  employeeResponsibility: z.number().nonnegative().optional().nullable(),
  companyResponsibility: z.number().nonnegative().optional().nullable(),
  leaveBalance: z.number().nonnegative().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  jobCadreId: z.string().uuid().optional().nullable(),
  jobTitleId: z.string().uuid().optional().nullable(),
  cityId: z.string().uuid().optional().nullable(),
  workBranchId: z.string().optional().nullable(),
  salaryBranchId: z.string().optional().nullable(),
  costCenterId: z.string().uuid().optional().nullable(),
  autoRenewal: z.boolean().optional(),
  attendancePolicy: z.boolean().optional(),
  incomeTax: z.boolean().optional(),
  generalNotes: z.string().optional().nullable(),
});

export const createEmployeeContractSchema = employeeContractFieldsSchema.refine(
  (data) => {
    if (data.contractEndDate && data.contractStartDate) {
      return data.contractStartDate < data.contractEndDate;
    }
    return true;
  },
  {
    message: 'Contract start date must be before end date',
    path: ['contractEndDate'],
  }
);

export const updateEmployeeContractSchema = employeeContractFieldsSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const employeeContractQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  jobTitleId: z.string().uuid().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateEmployeeContractInput = z.infer<typeof createEmployeeContractSchema>;
export type UpdateEmployeeContractInput = z.infer<typeof updateEmployeeContractSchema>;
export type EmployeeContractQueryInput = z.infer<typeof employeeContractQuerySchema>;
