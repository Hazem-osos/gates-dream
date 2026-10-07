/** Supported payroll rule DSL variables (from payroll context builder). */
export const PAYROLL_RULE_VARIABLE_CATALOG = [
  {
    group: 'Period',
    variables: ['period_days'],
  },
  {
    group: 'Compensation',
    variables: ['comp_basic', 'comp_housing', 'comp_transport', 'comp_fixed_allowances'],
  },
  {
    group: 'Time',
    variables: [
      'time_scheduled_minutes',
      'time_worked_minutes',
      'time_late_minutes',
      'time_early_leave_minutes',
      'time_absence_minutes',
      'time_late_billable_minutes',
      'time_early_leave_billable_minutes',
      'time_absence_billable_minutes',
      'time_approved_overtime_minutes',
    ],
  },
  {
    group: 'Leave',
    variables: ['leave_paid_minutes', 'leave_sick_minutes', 'leave_unpaid_minutes'],
  },
  {
    group: 'Inputs',
    variables: ['input_bonus'],
  },
  {
    group: 'Advances',
    variables: ['advance_due'],
  },
  {
    group: 'Localization',
    variables: [
      'statutory_insurance_cap',
      'statutory_employee_insurance_rate',
      'statutory_employer_insurance_rate',
    ],
  },
  {
    group: 'Tax',
    variables: ['tax_exemption'],
  },
];
