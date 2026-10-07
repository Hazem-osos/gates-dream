# Payroll Rule Engine

## Principles

- One calculation entry: `payrollRunCalculationService` / `payrollEngineService.createPayrollRun`.
- Rules are effective-dated rows on `HcmPayrollRule`, linked to `HcmPayComponent`.
- Formulas use `payroll-expression.evaluator` (no `eval` / `new Function`).
- Dependencies resolved via `orderPayrollRules` (phase order + topological sort on component codes).

## Phases (default)

| Phase | Purpose |
|------:|---------|
| 1 | Recurring earnings (`comp_*`, BASIC, allowances) |
| 2 | Time-based earnings/deductions (OT, absence, late) |
| 3 | One-time earnings (`input_*`) |
| 4 | Gross subtotals |
| 5–6 | Statutory bases and deductions |
| 7 | Other employee deductions |
| 8 | Advances |
| 9 | Employer contributions |
| 10 | Net |

Tenants may add rules; empty rule set → **LEGACY** mode (existing `calculateEmployeePayroll`).

## Context variables

Exposed on `PayrollCalculationContext.vars` — see `HCM_PAYROLL_CONTEXT.md`.

## Simulation

`POST /api/v1/hr/payroll/rules/simulate` with `employeeId`, period, `formulaExpr`, optional `conditionExpr`.
