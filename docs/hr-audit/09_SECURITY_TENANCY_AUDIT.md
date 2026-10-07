# Security, Permissions & Tenancy

## Authentication & tenant context

- Standard `authenticate` + `setTenantContext` on HR routes.
- Queries should filter `companyId` from `req.companyId`.

## Authorization model

| Resource | Actions | HR usage |
|----------|---------|----------|
| `employee` | view, edit, … | Employees, contracts, procedures, attendance, most masters |
| `payroll` | view, edit, approve | Payroll runs, settings, advances, disbursements |

**Granularity:** **COARSE** — no field-level (salary/bank) permissions.

## Roles (defaults)

- `role-definitions.service.ts` bundles payroll permissions for finance-like roles.
- **No** `hr_admin` vs `payroll_officer` vs `manager` split at data scope.

## Data scoping

| Scope | Supported |
|-------|-----------|
| Company | ✅ `companyId` on HR models |
| Branch | ⚠️ Payroll run only; employees not branch-scoped |
| Department | ❌ No filter by dept for managers |
| Direct reports | ❌ No manager graph |
| Self (ESS) | ❌ No employee-scoped token; `userId` link optional |

## Sensitive fields

- Salary, bank, national ID on `Employee` — returned in employee APIs if caller has `employee:view`.
- **Risk:** Manager role with `employee:view` sees all company employees' pay — **no row-level security**.

## Cross-company leakage checks

- Services generally use `findFirst({ where: { id, companyId } })` on employees — **good pattern**.
- Child tables (procedures) scope via `employee.companyId` — **good**.
- **Risk:** `findUnique` by id only without company check on any route — spot-check when implementing fixes (not done in this audit).

## Frontend-only hiding

- Many report pages — if API returns full employee object, UI hiding is insufficient.
- Payslip/salary pages require `payroll:view` on backend routes — **better**.

## Approval / SOX

- No HR workflow engine — **approve** permission on payroll without multi-step audit trail.

**Security/tenancy maturity:** **4/10** (tenant boundary OK at company level; weak HR confidentiality).

## Model tenancy classification

| Class | Examples |
|-------|----------|
| TENANT OWNED | Employee, Department, PayrollRun, HrSettings, lookups |
| GLOBAL | None in HR block |
| SHARED REFERENCE | Branch, CostCenter, Chart of accounts (accounting) |
| DERIVED | PayrollRunItem, clearance snapshots |
