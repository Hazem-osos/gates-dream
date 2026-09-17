# M9 — HR & Payroll Engine

## Scope

| Area | Implementation |
|------|----------------|
| **Employee profile** | Extended `Employee`: `fixedAllowances`, `socialInsuranceEnrolled`, `taxExemptionAmount`, `jobTitleId`, `costCenterId` |
| **Advances** | `EmployeeAdvance.remainingAmount`, `isSettled`; wave3 `/hr/advances` API |
| **Payroll run** | `PayrollRun` + `PayrollRunItem` with DRAFT → POSTED → PAID |
| **Calculation** | `PayrollEngineService`: gross, insurance (employee/employer rates from `HrSettings`), flat payroll tax, advance installments |
| **GL** | `PayrollPostingService`: accrual JE + treasury-style disbursement (Dr accrued / Cr safe or bank) |

## Schema (`20250816220000_wave3_m9_payroll`)

- **`HrSettings`** — GL account codes + `employeeInsuranceRate` (11%), `employerInsuranceRate` (18.75%), `payrollTaxFlatRate` (10% default; bracket engine follow-up)
- **`PayrollRun`** / **`PayrollRunItem`**

Legacy `monthly_salaries` CRUD remains for UI parity.

## API

| Method | Path |
|--------|------|
| POST | `/api/v1/hr/payroll-runs` — `{ periodMonth, periodYear, employeeInputs? }` |
| GET | `/api/v1/hr/payroll-runs/:id` |
| POST | `/api/v1/hr/payroll-runs/:id/post-accrual` |
| POST | `/api/v1/hr/payroll-runs/:id/disburse` — `{ safeId \| bankAccountId }` |
| POST | `/api/v1/hr/advances` |
| GET | `/api/v1/hr/advances` |

## Accrual entry (aggregated)

- **Dr** salaries expense — total gross  
- **Dr** employer insurance expense  
- **Cr** social insurance payable — employee + employer shares  
- **Cr** payroll tax payable  
- **Cr** employee advances — installment recoveries  
- **Cr** accrued payroll — net salaries  

## Test

```bash
npm run test:wave1-invoices   # fixtures
npm run test:wave3-payroll
```

## Follow-ups

- Progressive tax brackets (Egyptian kسب عمل tables)  
- Attendance / leave integration per employee  
- Link legacy `monthly-salaries` UI to `payroll-runs`  
- Per-employee cost center splits on salary expense lines  
