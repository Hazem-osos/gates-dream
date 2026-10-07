# HCM Payroll Architecture (Phase 0 Lock → Phase 5 Evolution)

**Status:** Architecture decision record — **locked for evolution**, not a rewrite mandate.

**Phase 5 addendum:** `payrollRunCalculationService` is the canonical run builder; optional `RULE_ENGINE` mode when `HcmPayrollRule` rows exist; immutable `HcmPayrollRunSnapshot` + `HcmPayrollItemComponent`. See `HCM_PAYROLL_RULE_ENGINE.md`, `HCM_PAYROLL_SNAPSHOT.md`.

## Canonical payroll calculation source of truth

**`PayrollRun` + `PayrollRunItem`** via `payroll-engine.service.ts` is the **only** engine that:

- Computes company payroll from active employees
- Persists immutable line snapshots per employee for a period
- Enforces period uniqueness (`@@unique([companyId, periodYear, periodMonth])`)
- Drives **accrual** and **payment** GL through `payroll-posting.service.ts`
- Applies **advance FIFO recovery** on accrual post (with reversal on unpost)

Target naming (future, optional rename only):

```
PayrollRun              → payroll run header
PayrollRunItem          → PayrollEmployeeResult (per employee)
(component rows TBD)    → PayrollComponentResult (Phase 5+)
```

## PayrollRun lifecycle (as implemented)

| Step | Behavior |
|------|----------|
| Input | Active employees (`basicSalary > 0`), optional `employeeInputs` (overtime, absence, other deductions), `HrSettings` rates, company `Allowance`/`Deduction` masters, reward/penalty procedures |
| Calculate | `calculateEmployeePayroll` per employee; aggregate totals |
| Persist | `status = DRAFT`, replace existing **DRAFT** run for same period |
| Recalculate | Allowed while `DRAFT` (delete + recreate) |
| Post accrual | `DRAFT` → `POSTED`; journal `PayrollAccrual`; advance recovery |
| Unpost accrual | `POSTED` (not paid) → `DRAFT`; reverse JE; restore advances |
| Disburse | `POSTED` → `PAID`; journal `PayrollPay`; treasury safe/bank |
| Unpost disbursement | `PAID` → `POSTED`; reverse payment JE |
| Block recalc | `createPayrollRun` throws if existing run `status !== 'DRAFT'` |

## MonthlySalary — actual roles (code evidence)

### Path 1 — Manual CRUD (`monthly-salary.service.ts`)

- **Input:** User/API supplies all monetary fields (`basicSalary`, `netSalary`, allowances, etc.)
- **Calculation:** **None** in service
- **Posting:** **No** GL integration on `MonthlySalary` row
- **UI:** `gates-web/app/hr/monthly-salaries/page.tsx`
- **Permission:** `monthly-salary` resource (separate from `payroll`)

### Path 2 — Async job (`POST /hr/payroll/calculate` → `payroll.processor.ts`)

- **Input:** Active `EmployeeContract` rows for period
- **Calculation:** Separate formula (contract `basicSalary`, procedure rewards/penalties, contract insurance %; allowances/deductions **hardcoded 0**; overtime/absence **0**)
- **Output:** Creates `MonthlySalary` rows via `monthlySalaryService.createMonthlySalary`
- **Posting:** **None**
- **Does not** read or write `PayrollRun`

### Path 3 — Reporting / AI

- `reports.service.ts` batch-loads `MonthlySalary` for some reports
- `hr-payroll.tool.ts` aggregates `monthlySalary` table

### Path 4 — Disbursement header (`MonthlySalariesDisbursement`)

- Operational **document header** (month/year/serial) — **not** tied to GL or `PayrollRun` in service code reviewed

## Classification: what is MonthlySalary?

**Primary:** **C — Historical / parallel operational register** (manual payslip lines + legacy async generator)

**Not:** **A** — second engine with accounting (no GL on MonthlySalary)

**Partially:** **B** — disbursement *metadata* exists separately from PayrollRun payment

**Not:** **D** — not a projection of PayrollRun (no FK, no sync)

## Phase 0 decision: MonthlySalary

| Decision | **REPURPOSE** (target state) |
|----------|------------------------------|
| Now | **KEEP** all APIs and data — no removal |
| Target | Becomes **payslip register / employee-facing snapshot** optionally **generated from** posted `PayrollRunItem`, or manual adjustment layer with explicit link to run |
| Async job | **DEPRECATE** as calculation source (stop enqueueing for new tenants once UI uses payroll-runs) |
| Migration | Map period `MonthlySalary` rows to `PayrollRunItem` where amounts match; flag conflicts for HR review |

## Dual-track risk

Using **both** `PayrollRun` (GL) and **MonthlySalary** (reports/UI) for the same month can produce **two different nets**. Phase 1+ UI should prefer payroll-run data for financial truth.

## Financial invariants (locked)

1. Accrual post only when `status === 'DRAFT'` — second accrual post rejected.
2. Disburse only when `POSTED` and no `paymentJournalEntryId`.
3. Accrual JE debits = credits (via `journalPostingService`).
4. Posted run items are **not** updated when `Employee.basicSalary` changes (snapshot).
5. Advance recovery mutates `EmployeeAdvance.remainingAmount` only inside accrual post transaction; unpost restores (LIFO vs FIFO inverse).
6. Payroll queries scoped by `companyId` on run and `getPayrollRun(companyId, id)`.
7. `MonthlySalary` create validates `employee.companyId`.
8. Second disburse attempt on `PAID` run currently fails with **“Payroll must be POSTED”** (status check before `paymentJournalEntryId`) — idempotent at financial level, message may be refined later.

## Money / precision

- Storage: `Decimal(15,2)` / rates `Decimal(8,6)`.
- Engine uses `Number()` + `roundTo4` at boundaries; posting uses `roundTo4` on totals.
- Known limitation: JS `Number` in engine — acceptable for Phase 0; Phase 5 should centralize decimal math.

## Regression tests

`gates-backend/src/__tests__/integration/payroll-phase0.integration.spec.ts`  
Also: `npm run test:wave3-payroll` (fixture-based script).
