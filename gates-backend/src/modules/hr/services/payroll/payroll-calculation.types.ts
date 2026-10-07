export type PayrollPeriodFacts = {
  year: number;
  month: number;
  start: string;
  end: string;
  calendarDays: number;
};

export type PayrollEmployeeSnapshot = {
  employeeId: string;
  employmentId: string;
  branchId?: string | null;
  departmentId?: string | null;
  costCenterId?: string | null;
  countryCode: string;
  socialInsuranceEnrolled: boolean;
  taxExemptionAmount: number;
};

export type PayrollCompensationSegment = {
  componentCode: string;
  effectiveFrom: string;
  effectiveTo: string;
  fullAmount: number;
  prorationBasis: string;
  basisQuantity: number;
  segmentDays: number;
  proratedAmount: number;
};

export type PayrollCompensationFacts = {
  /** Prorated period totals by component code */
  byCode: Record<string, number>;
  currencyCode: string;
  segments: PayrollCompensationSegment[];
};

export type PayrollTimeFacts = {
  scheduledMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  absenceMinutes: number;
  approvedOvertimeMinutes: number;
  paidLeaveMinutes: number;
  unpaidLeaveMinutes: number;
  sickLeaveMinutes: number;
  otherApprovedLeaveMinutes: number;
  readyForPayroll: boolean;
  unresolvedExceptionCount?: number;
  lateBillableMinutes?: number;
  earlyLeaveBillableMinutes?: number;
  absenceBillableMinutes?: number;
};

export type PayrollLeaveFacts = PayrollTimeFacts;

export type PayrollAdvanceFacts = {
  dueAmount: number;
  lines: Array<{ advanceId: string; amount: number }>;
};

export type PayrollOneTimeFacts = Record<string, number>;

export type PayrollStatutoryFacts = Record<string, number>;

export type PayrollCalculationContext = {
  period: PayrollPeriodFacts;
  employee: PayrollEmployeeSnapshot;
  compensation: PayrollCompensationFacts;
  time: PayrollTimeFacts;
  leave: PayrollLeaveFacts;
  advances: PayrollAdvanceFacts;
  inputs: PayrollOneTimeFacts;
  /** Approved one-time input row ids included in this calculation */
  oneTimeInputIds: string[];
  statutory: PayrollStatutoryFacts;
  /** Runtime component amounts comp_<CODE> and rule outputs */
  vars: Record<string, number>;
};

export type CalculatedComponentLine = {
  componentCode: string;
  componentType: string;
  payComponentId?: string;
  phase: number;
  amount: number;
  quantity?: number;
  baseAmount?: number;
  rate?: number;
  ruleCode?: string;
  ruleId?: string;
  ruleFingerprint?: string;
  ruleFormulaFingerprint?: string;
  roundingMode?: string;
  branchIdSnapshot?: string | null;
  departmentIdSnapshot?: string | null;
  costCenterIdSnapshot?: string | null;
  glExpenseAccountIdSnapshot?: string | null;
  glPayableAccountIdSnapshot?: string | null;
  sourceType?: string;
  sourceRef?: string;
  explanation?: Record<string, unknown>;
};

export type EmployeePayrollCalculationResult = {
  employeeId: string;
  components: CalculatedComponentLine[];
  basicSalary: number;
  allowances: number;
  overtime: number;
  absenceDeduction: number;
  otherDeductions: number;
  grossSalary: number;
  employerInsurance: number;
  employeeInsurance: number;
  tax: number;
  advanceDeduction: number;
  netSalary: number;
  blockers: string[];
};
