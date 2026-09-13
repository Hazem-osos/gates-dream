import { z } from 'zod';

export const createStudentSchema = z.object({
  serial: z.string().optional(),
  studentName: z.string().min(1, 'Student name is required'),
  year: z.string().optional(),
  fatherName: z.string().optional(),
  fatherGrandfather: z.string().optional(),
  fatherGreatGrandfather: z.string().optional(),
  motherName: z.string().optional(),
  motherGrandfather: z.string().optional(),
  motherGreatGrandfather: z.string().optional(),
  currencyCode: z.string().optional(),
  stageId: z.string().uuid().optional().nullable(),
  semesterId: z.string().uuid().optional().nullable(),
  paymentType: z.string().optional(),
  enrollment: z.string().optional(),
});

export const updateStudentSchema = createStudentSchema.partial().extend({
  isFinished: z.boolean().optional(),
});

export const studentQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  stageId: z.string().uuid().optional().nullable(),
  semesterId: z.string().uuid().optional().nullable(),
  isFinished: z.string().optional().transform((val) => val === 'true'),
});

export const createInstallmentSchema = z.object({
  installment: z.number().int().positive(),
  date: z.string().datetime().or(z.date()),
  value: z.number().nonnegative(),
  carValue: z.number().nonnegative().optional(),
  educationDiscount: z.number().nonnegative().optional(),
  carDiscount: z.number().nonnegative().optional(),
});

export const expensesRefundSchema = z.object({
  receipt: z.string().optional(),
  serial: z.string().optional(),
  description: z.string().optional(),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  education: z.number().nonnegative().optional(),
  books: z.number().nonnegative().optional(),
  activity: z.number().nonnegative().optional(),
  other: z.number().nonnegative().optional(),
  car: z.number().nonnegative().optional(),
  total: z.number().nonnegative(),
  specificAmount: z.number().nonnegative().optional(),
  paid: z.number().nonnegative().optional(),
  paymentMethod: z.string().optional(),
  year: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentQueryInput = z.infer<typeof studentQuerySchema>;
export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;
export type ExpensesRefundInput = z.infer<typeof expensesRefundSchema>;
