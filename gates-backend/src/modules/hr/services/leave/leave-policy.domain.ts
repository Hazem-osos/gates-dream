export type LeavePolicyRules = {
  entitlementModel?: 'ANNUAL_GRANT' | 'MONTHLY_ACCRUAL';
  annualGrantDays?: number;
  monthlyAccrualDays?: number;
  prorationMethod?: 'CALENDAR_DAYS' | 'MONTHS' | 'NONE';
  carryForwardMaxDays?: number;
  carryForwardExpiryMonth?: number;
  carryForwardExpiryDay?: number;
  countWeekends?: boolean;
  countHolidays?: boolean;
  sandwichRule?: boolean;
  allowHalfDay?: boolean;
  allowHourly?: boolean;
  allowNegativeBalance?: boolean;
  negativeLimitDays?: number;
  minRequestDays?: number;
  maxRequestDays?: number;
  reserveOnSubmit?: boolean;
  probationAllowsUsage?: boolean;
  /** ALLOW | ACCRUE_ONLY | NO_USAGE */
  probationMode?: 'ALLOW' | 'ACCRUE_ONLY' | 'NO_USAGE';
  noticePeriodRestrictsLeave?: boolean;
  backdatedDaysLimit?: number;
};

export type LeaveTypePolicyRules = LeavePolicyRules & {
  entitlementDays?: number;
};

export const DEFAULT_LEAVE_POLICY: LeavePolicyRules = {
  entitlementModel: 'ANNUAL_GRANT',
  annualGrantDays: 21,
  prorationMethod: 'CALENDAR_DAYS',
  countWeekends: false,
  countHolidays: false,
  sandwichRule: false,
  allowHalfDay: true,
  allowHourly: true,
  allowNegativeBalance: false,
  reserveOnSubmit: true,
  probationAllowsUsage: true,
};
