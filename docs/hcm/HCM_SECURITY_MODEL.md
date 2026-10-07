# HCM Security Model (Baseline + Target)

## Phase 0 (actual)

- Resources: `employee`, `payroll`, `monthly-salary` (separate).
- Company isolation via `req.companyId` + service `findFirst({ companyId })`.
- Prisma tenant extension on many models (see `tenant-scoping-extension.test.ts`).
- **No** field-level salary/bank masking.
- **No** manager-scoped row filters.

## Phase 0 actions

- Document violations; fix **critical** cross-company only if found.
- Regression: `payroll-phase0.integration.spec.ts` (company B cannot read company A run; monthly salary rejects wrong employee).

## Target roles (not implemented)

| Role | Scope | Sensitive access |
|------|-------|------------------|
| Employee self | Own `employeeId` | Own payslip, leave, attendance; edit limited PII |
| Direct manager | Direct reports | No salary/bank by default |
| HR officer | Company HR data | PII, documents; not payroll post |
| Payroll officer | Payroll + compensation | Salary, bank, GL post |
| HR manager | All HR | + disciplinary |
| Finance | Posted payroll, GL | Read payroll results |
| Company admin | Tenant config | HrSettings |

## Sensitive groups

Salary, bank, government IDs, disciplinary, performance, documents — require **explicit** permission keys in future (`payroll:view-salary`, etc.).

## Endpoints at risk under future model

- `GET /hr/employees` — returns full employee including salary (if included in select).
- `GET /hr/employees/:id` — same.
- Any report exporting employee master without role check.

Phase 0: **document only** unless cross-company bug found.
