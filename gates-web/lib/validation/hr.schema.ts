import { z } from 'zod';

function preprocessBasicSalary(val: unknown): number {
  if (val === '' || val === null || val === undefined) return NaN;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const n = Number(String(val).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Core HR employee master fields (validated before save).
 * `employeeName` maps to API `arabicName`; `nationalId` maps to `identityNumber`.
 */
export const employeeSchema = z.object({
  employeeName: z
    .string()
    .trim()
    .min(3, 'اسم الموظف مطلوب (ثلاثة أحرف على الأقل)'),
  nationalId: z
    .string()
    .trim()
    .min(8, 'رقم الهوية مطلوب')
    .max(20, 'رقم الهوية غير صالح'),
  joinDate: z.string().min(1, 'تاريخ الالتحاق بالعمل مطلوب'),
  basicSalary: z.preprocess(
    preprocessBasicSalary,
    z
      .number({ error: 'الراتب الأساسي غير صالح' })
      .refine((n) => !Number.isNaN(n), 'الراتب الأساسي مطلوب')
      .refine((n) => n > 0, 'الراتب الأساسي يجب أن يكون أكبر من صفر')
  ),
  departmentId: z.string().uuid({ message: 'يجب اختيار القسم' }),
  employeeId: z.string().optional(),
  serialNumber: z.string().optional(),
  englishName: z.string().optional(),
  user: z.string().optional(),
  gender: z.enum(['ذكر', 'أنثى']).optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  maritalStatus: z.string().optional(),
  birthDate: z.string().optional(),
  academicQualification: z.string().optional(),
  specialization: z.string().optional(),
  university: z.string().optional(),
  passportNumber: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  socialInsurance: z.string().optional(),
  advanceAccount: z.string().optional(),
});

/** Form state (inputs may be strings before coercion). */
export type EmployeeFormInput = z.input<typeof employeeSchema>;
/** Validated payload after zod parse. */
export type EmployeeFormValues = z.infer<typeof employeeSchema>;

/** HR master-data rows: nationalities, religions, cities, allowances, etc. (matches typical POST bodies). */
export const hrMasterCodeRecordSchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().trim().min(1, 'الإسم العربي مطلوب'),
  englishName: z.string().optional(),
});

export type HrMasterCodeRecordInput = z.input<typeof hrMasterCodeRecordSchema>;

export const hrDepartmentFormSchema = hrMasterCodeRecordSchema.extend({
  managementId: z.string().optional(),
});

export type HrDepartmentFormInput = z.input<typeof hrDepartmentFormSchema>;

export const workShiftFormSchema = z.object({
  serialNumber: z.string().optional(),
  englishName: z.string().optional(),
  arabicName: z.string().trim().min(1, 'الإسم العربي مطلوب'),
  employee: z.string().min(1, 'اختر الموظف'),
  fromTime: z.string().trim().min(1, 'من وقت مطلوب'),
  toTime: z.string().trim().min(1, 'إلى وقت مطلوب'),
});

export type WorkShiftFormInput = z.input<typeof workShiftFormSchema>;

export const companyLeaveDaysDefinitionSchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().trim().min(1, 'الإسم العربي مطلوب'),
  englishName: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
});

export type CompanyLeaveDaysDefinitionInput = z.input<typeof companyLeaveDaysDefinitionSchema>;

const positiveDecimalString = (emptyMsg: string, invalidMsg: string) =>
  z
    .string()
    .min(1, emptyMsg)
    .refine((s) => {
      const n = Number(String(s).replace(',', '.').trim());
      return Number.isFinite(n) && n > 0;
    }, invalidMsg);

export const absencePermissionFormSchema = z.object({
  code: z.string().optional(),
  englishName: z.string().optional(),
  arabicName: z.string().trim().min(1, 'الإسم العربي مطلوب'),
  employee: z.string().min(1, 'اختر الموظف'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  reason: z.string().trim().min(1, 'السبب مطلوب'),
});

export type AbsencePermissionFormInput = z.input<typeof absencePermissionFormSchema>;

export const delayPermissionFormSchema = absencePermissionFormSchema.extend({
  hours: positiveDecimalString('الساعات مطلوبة', 'أدخل عدد ساعات صالحاً'),
});

export type DelayPermissionFormInput = z.input<typeof delayPermissionFormSchema>;

/** إعادة مباشرة — حقول التواريخ كما في الواجهة (مباشرة + فترة). */
export const employeeReinstatementFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'اختر الموظف'),
  fromDate: z.string().min(1, 'تاريخ المباشرة مطلوب'),
  fromHijriDate: z.string().optional(),
  toDate: z.string().min(1, 'إلى التاريخ مطلوب'),
  toHijriDate: z.string().optional(),
  requiredDays: z.string().optional(),
  availableDays: z.string().optional(),
  notes: z.string().optional(),
});

export type EmployeeReinstatementFormInput = z.input<typeof employeeReinstatementFormSchema>;

export const transactionTrackingFilterSchema = z.object({
  hijriDate1: z.string().optional(),
  hijriDate2: z.string().optional(),
  employee: z.string().min(1, 'أدخل أو اختر الموظف'),
  fromDate: z.string().min(1, 'من التاريخ مطلوب'),
  toDate: z.string().min(1, 'إلى التاريخ مطلوب'),
  transactionType: z.string().min(1, 'نوع المعاملة مطلوب'),
});

export type TransactionTrackingFilterInput = z.input<typeof transactionTrackingFilterSchema>;

/** فلاتر تقارير HR بنص موظف حر (بدون قائمة API). */
export const hrSimpleReportFilterSchema = z.object({
  hijriDate1: z.string().optional(),
  hijriDate2: z.string().optional(),
  employee: z.string().min(1, 'أدخل الموظف'),
  fromDate: z.string().min(1, 'من التاريخ مطلوب'),
  toDate: z.string().min(1, 'إلى التاريخ مطلوب'),
});

export type HrSimpleReportFilterInput = z.input<typeof hrSimpleReportFilterSchema>;

/** فلاتر تقرير مع اختيار موظف من `/hr/employees` ثم انتقال لمعاينة. */
export const hrEmployeeApiReportFilterSchema = z.object({
  hijriDate1: z.string().optional(),
  hijriDate2: z.string().optional(),
  employeeId: z.string().optional(),
  fromDate: z.string().min(1, 'من التاريخ مطلوب'),
  toDate: z.string().min(1, 'إلى التاريخ مطلوب'),
});

export type HrEmployeeApiReportFilterInput = z.input<typeof hrEmployeeApiReportFilterSchema>;

export const annualLeaveRegistrationFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().trim().min(1, 'الموظف مطلوب'),
  fromDate: z.string().min(1, 'من التاريخ مطلوب'),
  fromHijriDate: z.string().optional(),
  toDate: z.string().min(1, 'إلى التاريخ مطلوب'),
  toHijriDate: z.string().optional(),
  requiredDays: z.string().optional(),
  availableDays: z.string().optional(),
  notes: z.string().optional(),
});

export type AnnualLeaveRegistrationFormInput = z.input<typeof annualLeaveRegistrationFormSchema>;

export const employeeWarningFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'اختر الموظف'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  value: z
    .string()
    .min(1, 'القيمة مطلوبة')
    .refine((s) => {
      const n = Number(String(s).replace(',', '.').trim());
      return Number.isFinite(n) && n >= 0;
    }, 'قيمة غير صالحة'),
  unit: z.string().min(1, 'اختر الوحدة'),
  reason: z.string().trim().min(1, 'السبب مطلوب'),
  notes: z.string().optional(),
});

export type EmployeeWarningFormInput = z.input<typeof employeeWarningFormSchema>;

/** مكافأة / جزاء / تذكية / إنذار — نفس الحقول والتحقق. */
export const hrEmployeeValueUnitReasonFormSchema = employeeWarningFormSchema;
export type HrEmployeeValueUnitReasonFormInput = EmployeeWarningFormInput;

/** نقل / ترقية / إيقاف / إنهاء خدمة — نموذج موحد (إلى إدارة وقسم). */
export const hrEmployeeDepartmentMoveFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'اختر الموظف'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  reason: z.string().trim().min(1, 'السبب مطلوب'),
  toDepartment: z.string().min(1, 'اختر الإدارة'),
  toSection: z.string().min(1, 'اختر القسم'),
  notes: z.string().optional(),
});

export type HrEmployeeDepartmentMoveFormInput = z.input<typeof hrEmployeeDepartmentMoveFormSchema>;

export const employeeSecondmentFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'اختر الموظف'),
  fromDate: z.string().min(1, 'من التاريخ مطلوب'),
  fromHijriDate: z.string().optional(),
  toDate: z.string().min(1, 'إلى التاريخ مطلوب'),
  toHijriDate: z.string().optional(),
  placement: z.string().trim().min(1, 'مكان الإنتداب مطلوب'),
  notes: z.string().optional(),
});

export type EmployeeSecondmentFormInput = z.input<typeof employeeSecondmentFormSchema>;

export const employeeOnboardingFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'اختر الموظف'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  notes: z.string().optional(),
});

export type EmployeeOnboardingFormInput = z.input<typeof employeeOnboardingFormSchema>;

export const employeeTrainingCourseFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'اختر الموظف'),
  fromDate: z.string().min(1, 'من التاريخ مطلوب'),
  fromDateHijri: z.string().optional(),
  toDate: z.string().min(1, 'إلى التاريخ مطلوب'),
  toDateHijri: z.string().optional(),
  courseName: z.string().trim().min(1, 'إسم الدورة مطلوب'),
  courseLocation: z.string().trim().min(1, 'مكان الدورة مطلوب'),
  notes: z.string().optional(),
});

export type EmployeeTrainingCourseFormInput = z.input<typeof employeeTrainingCourseFormSchema>;

export const employeeWorkingDaysHeaderSchema = z.object({
  serialNumber: z.string().optional(),
  englishName: z.string().optional(),
  arabicName: z.string().optional(),
  employee: z.string().min(1, 'اختر الموظف'),
  workBranch: z.string().optional(),
});

export type EmployeeWorkingDaysHeaderInput = z.input<typeof employeeWorkingDaysHeaderSchema>;

export const employeeAttendancePreviewFilterSchema = z.object({
  year: z.string().min(1, 'السنة مطلوبة'),
  month: z.string().min(1, 'الشهر مطلوب'),
  employee: z.string().min(1, 'الموظف مطلوب'),
});

export type EmployeeAttendancePreviewFilterInput = z.input<typeof employeeAttendancePreviewFilterSchema>;

export const attendanceFingerprintFormSchema = z.object({
  month: z.string().min(1, 'الشهر مطلوب'),
  year: z.string().min(1, 'السنة مطلوبة'),
  monthDays: z.string().optional(),
  sheet: z.string().min(1, 'الشيت مطلوب'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  employeeId: z.string().min(1, 'رقم الموظف مطلوب'),
  entryExitCode: z.string().min(1, 'رمز الدخول والخروج مطلوب'),
  time: z.string().min(1, 'الوقت مطلوب'),
});

export type AttendanceFingerprintFormInput = z.input<typeof attendanceFingerprintFormSchema>;

/** غياب الموظفين والإضافي — رأس النموذج (جدول الصفوف يبقى محلياً). */
export const employeeAbsenceOvertimeHeaderSchema = z.object({
  serialNumber: z.string().optional(),
  arabicDescription: z.string().optional(),
  englishDescription: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  year: z.string().min(1, 'السنة مطلوبة'),
  month: z.string().min(1, 'الشهر مطلوب'),
  costCenter: z.string().optional(),
  department: z.string().optional(),
  section: z.string().optional(),
  jobCadre: z.string().optional(),
  jobTitle: z.string().optional(),
  city: z.string().optional(),
  wagePolicy: z.string().optional(),
  salaryBranch: z.string().optional(),
});

export type EmployeeAbsenceOvertimeHeaderInput = z.input<typeof employeeAbsenceOvertimeHeaderSchema>;

const hrEntitlementDisbursementBaseSchema = z.object({
  paymentMethod: z.enum(['بنك', 'صندوق']),
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'الموظف مطلوب'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  amount: z.string().optional(),
  notes: z.string().optional(),
  record: z.string().optional(),
});

export const annualLeaveEntitlementsDisbursementFormSchema = hrEntitlementDisbursementBaseSchema.extend({
  vacationId: z.string().min(1, 'الأجازة مطلوبة'),
});
export type AnnualLeaveEntitlementsDisbursementFormInput = z.input<
  typeof annualLeaveEntitlementsDisbursementFormSchema
>;

export const endOfServiceEntitlementsDisbursementFormSchema = hrEntitlementDisbursementBaseSchema.extend({
  vacationId: z.string().optional(),
});
export type EndOfServiceEntitlementsDisbursementFormInput = z.input<
  typeof endOfServiceEntitlementsDisbursementFormSchema
>;

export const housingAllowanceEntitlementsDisbursementFormSchema = hrEntitlementDisbursementBaseSchema.extend({
  housingRef: z.string().optional(),
});
export type HousingAllowanceEntitlementsDisbursementFormInput = z.input<
  typeof housingAllowanceEntitlementsDisbursementFormSchema
>;

export const annualLeaveEntitlementsClearanceFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'الموظف مطلوب'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  fromDate: z.string().min(1, 'من تاريخ مطلوب'),
  fromDateHijri: z.string().optional(),
  toDate: z.string().min(1, 'إلى تاريخ مطلوب'),
  toDateHijri: z.string().optional(),
  lastDirectDate: z.string().min(1, 'تاريخ أخر مباشرة مطلوب'),
  lastDirectDateHijri: z.string().optional(),
  workDays: z.string().optional(),
  dueDays: z.string().optional(),
  previousBalance: z.string().optional(),
  totalAvailableDays: z.string().optional(),
  monthlySalary: z.string().optional(),
  availableAllowances: z.string().optional(),
  totalValue: z.string().optional(),
  dueTickets: z.string().optional(),
  addedValue: z.string().optional(),
  requiredDays: z.string().optional(),
  deductedValue: z.string().optional(),
  leaveEntitlements: z.string().optional(),
  totalEntitlements: z.string().optional(),
  notes: z.string().optional(),
  record: z.string().optional(),
});
export type AnnualLeaveEntitlementsClearanceFormInput = z.input<typeof annualLeaveEntitlementsClearanceFormSchema>;

export const endOfServiceEntitlementsClearanceFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'الموظف مطلوب'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  workDays: z.string().optional(),
  absenceDays: z.string().optional(),
  yearsOfWork: z.string().optional(),
  netWorkDays: z.string().optional(),
  vacationDays: z.string().optional(),
  dueDays: z.string().optional(),
  dueDaysValue: z.string().optional(),
  monthlySalary: z.string().optional(),
  totalValue: z.string().optional(),
  vacationDaysValue: z.string().optional(),
  notes: z.string().optional(),
  record: z.string().optional(),
});
export type EndOfServiceEntitlementsClearanceFormInput = z.input<
  typeof endOfServiceEntitlementsClearanceFormSchema
>;

export const housingAllowanceClearanceFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'الموظف مطلوب'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  daysSinceLastDisbursement: z.string().optional(),
  monthsSinceLastDisbursement: z.string().optional(),
  availableAdditions: z.string().optional(),
  monthlySalary: z.string().optional(),
  totalValue: z.string().optional(),
  totalSalary: z.string().optional(),
  notes: z.string().optional(),
  record: z.string().optional(),
});
export type HousingAllowanceClearanceFormInput = z.input<typeof housingAllowanceClearanceFormSchema>;

export const monthlySalariesDisbursementFormSchema = z.object({
  serialNumber: z.string().optional(),
  month: z.string().min(1, 'الشهر مطلوب'),
  year: z.string().min(1, 'السنة مطلوبة'),
  notes: z.string().optional(),
  record: z.string().optional(),
});
export type MonthlySalariesDisbursementFormInput = z.input<typeof monthlySalariesDisbursementFormSchema>;

const positiveAmountString = z
  .string()
  .min(1, 'القيمة مطلوبة')
  .refine((s) => {
    const n = Number(String(s).replace(',', '.').trim());
    return Number.isFinite(n) && n > 0;
  }, 'قيمة غير صالحة');

export const employeeAdvanceFormSchema = z.object({
  paymentMethod: z.enum(['fund', 'bank']),
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'اختر الموظف'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  value: positiveAmountString,
  monthlyInstallment: z.string().optional(),
  fromMonth: z.string().optional(),
  toYear: z.string().optional(),
  notes: z.string().optional(),
  record: z.string().optional(),
});
export type EmployeeAdvanceFormInput = z.input<typeof employeeAdvanceFormSchema>;

/** رواتب شهرية + إجراءات موظفين — رأس الفلاتر والوصف. */
export const hrMonthlyOperationsHeaderSchema = z.object({
  serialNumber: z.string().optional(),
  department: z.string().optional(),
  section: z.string().optional(),
  jobCadre: z.string().optional(),
  jobTitle: z.string().optional(),
  city: z.string().optional(),
  wagePolicy: z.string().optional(),
  salaryBranch: z.string().optional(),
  costCenter: z.string().optional(),
  arabicDescription: z.string().optional(),
  englishDescription: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  /** فلاتر الجدول؛ قد تكون فارغة حتى يختار المستخدم */
  year: z.string().optional(),
  month: z.string().optional(),
  record: z.string().optional(),
});
export type HrMonthlyOperationsHeaderInput = z.input<typeof hrMonthlyOperationsHeaderSchema>;

export const hrSettingsFormSchema = z.object({
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
});
export type HrSettingsFormInput = z.input<typeof hrSettingsFormSchema>;

export const transactionModelFormSchema = z.object({
  code: z.string().optional(),
  englishName: z.string().optional(),
  arabicName: z.string().trim().min(1, 'الإسم العربي مطلوب'),
  boldFont: z.boolean(),
  fontSize: z.string().optional(),
  fontFamily: z.string().optional(),
  content: z.string().optional(),
});
export type TransactionModelFormInput = z.input<typeof transactionModelFormSchema>;

export const employeeContractFormSchema = z.object({
  serialNumber: z.string().optional(),
  employee: z.string().min(1, 'اختر الموظف'),
  contractStartDate: z.string().min(1, 'تاريخ بداية العقد مطلوب'),
  contractEndDate: z.string().optional(),
  wagePolicy: z.string().optional(),
  basicSalary: z
    .string()
    .min(1, 'الراتب الأساسي مطلوب')
    .refine((s) => {
      const n = Number(String(s).replace(',', '.').trim());
      return Number.isFinite(n) && n >= 0;
    }, 'راتب غير صالح'),
  insuranceSalary: z.string().optional(),
  insurancePercentage: z.string().optional(),
  paymentMethod: z.enum(['fund', 'bank']),
  employeeResponsibility: z.string().optional(),
  companyResponsibility: z.string().optional(),
  leaveBalance: z.string().optional(),
  department: z.string().optional(),
  section: z.string().optional(),
  jobCadre: z.string().optional(),
  jobTitle: z.string().optional(),
  city: z.string().optional(),
  workBranch: z.string().optional(),
  salaryBranch: z.string().optional(),
  costCenter: z.string().optional(),
  autoRenewal: z.boolean(),
  attendancePolicy: z.boolean(),
  incomeTax: z.boolean(),
  generalNotes: z.string().optional(),
});
export type EmployeeContractFormInput = z.input<typeof employeeContractFormSchema>;
