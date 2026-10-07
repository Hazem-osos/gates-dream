# Payroll Calculation Context

Controlled facts for rules (no arbitrary DB access).

## Period

- `period_days`

## Compensation

- `comp_basic`, `comp_fixed_allowances`
- `comp_<code>` lowercased per pay component assignment

## Time

- `time_scheduled_minutes`, `time_worked_minutes`
- `time_late_minutes`, `time_early_leave_minutes`, `time_absence_minutes`
- `time_approved_overtime_minutes`

## Leave (minutes, from time read model)

- `leave_paid_minutes`, `leave_unpaid_minutes`, `leave_sick_minutes`

## Inputs

- `input_<code>` from approved one-time inputs

## Advances

- `advance_due` (installment sum, FIFO order aligned with posting)

## Statutory (localization)

- `statutory_*` from `HrSettings` + `HcmPayrollLocalizationConfig`

## Rule outputs

- After evaluation: `comp_<componentCode>` updated with calculated amount
