# HCM Payroll — Current State Audit (Phase 5)

**Date:** 2026-10-05  
**Scope:** Runtime payroll paths in `gates-backend` + `gates-web` consumers.

## Classification legend

| Tag | Meaning |
|-----|---------|
| KEEP | Production path, preserve behavior |
| EVOLVE | Canonical; extend in Phase 5 |
| REPURPOSE | Non-canonical target role |
| DEPRECATE | Stop new use; delegate |
| LEGACY_READ_ONLY | Historical only |
| REMOVE_LATER | Delete after migration |

## Canonical financial path

| Artifact | Classification | Notes |
|----------|----------------|-------|
| `PayrollRun` | **EVOLVE** | Unique per company/period; statuses `DRAFT` / `POSTED` / `PAID` |
| `PayrollRunItem` | **EVOLVE** | Per-employee totals; Phase 5 adds `HcmPayrollItemComponent` children |
| `payroll-engine.service.ts` | **EVOLVE** | `calculateEmployeePayroll` legacy formula; `createPayrollRun` → `payroll-run-calculation.service` |
| `payroll-run-calculation.service.ts` | **KEEP** | Phase 5 entry: snapshot + components + legacy/rule modes |
| `payroll-posting.service.ts` | **KEEP** | Accrual/payment JE; FIFO advance recovery on post |
| `payroll-run.routes.ts` | **KEEP** | `/api/v1/hr/payroll-runs` |
| `hcm-payroll.routes.ts` | **EVOLVE** | Components, rules, simulate, preview, payslip read |

## Secondary / legacy paths

| Artifact | Classification | Notes |
|----------|----------------|-------|
| `MonthlySalary` + `monthly-salary.service` | **REPURPOSE** | Manual CRUD; not GL; not canonical |
| `POST /hr/payroll/calculate` + `payroll.processor` | **DEPRECATE** | Writes `MonthlySalary`; parallel engine |
| `Employee.basicSalary` / `fixedAllowances` | **LEGACY_READ_ONLY** (projection) | Used when no HCM compensation/components |
| `HcmCompensationAssignment` | **EVOLVE** | Effective-dated basic + fixed; component assignments added Phase 5 |
| `Allowance` / `Deduction` masters | **KEEP** (legacy calc) | Summed in legacy `calculateEmployeePayroll` |
| `EmployeeProcedure` reward/penalty | **KEEP** | Legacy calc |
| `EmployeeAdvance` | **KEEP** | Recovery on post; engine computes installment due |

## Upstream facts (Phases 1–4)

| Source | Service | Payroll use |
|--------|---------|-------------|
| Employment / assignment | `HcmEmployment`, assignments | Snapshot org/cost center |
| Compensation | `HcmCompensationAssignment`, `HcmCompensationComponentAssignment` | `comp_*` context vars |
| Time | `time-payroll-read.service.ts` | Minutes; `readyForPayroll` gate when rules active |
| Leave | Attendance day leave columns | Same read service; no double absence+unpaid in rules |
| One-time inputs | `HcmPayrollOneTimeInput` | APPROVED → consumed on run |
| Statutory | `HrSettings` + `HcmPayrollLocalizationConfig` | Rates/brackets via config, not hardcoded law |

## Accounting

| Piece | Classification |
|-------|----------------|
| `hr-gl-account-resolver.service` | **KEEP** |
| Accrual / payment posting on `PayrollRun` | **KEEP** |
| Component GL on `HcmPayComponent` | **EVOLVE** (fields present; posting mapping Phase 5+) |

## Runtime flow (after Phase 5 foundation)

```
createPayrollRun (payroll-runs POST)
  → payrollRunCalculationService.createPayrollRun
      → per employee: readiness → context builder → rule engine OR legacy
      → persist PayrollRunItem + HcmPayrollItemComponent
      → HcmPayrollRunSnapshot.inputSnapshot + ruleSetFingerprint
post-accrual → payroll-posting (unchanged)
```

## MonthlySalary consumers (grep baseline)

| Consumer | Classification |
|----------|----------------|
| `monthly-salary.routes` / UI | **KEEP** until UI migrates |
| `payroll.processor` | **DEPRECATE** |
| `payroll-phase0.integration.spec` | **KEEP** (tests MonthlySalary CRUD only in one case) |
| HR reports / AI tools | **MIGRATE_TO_PAYROLLRUN** (documented; not Phase 5 complete) |

## Gaps remaining for full Phase 5 completion

- Full rule seed packs per tenant; Egypt/Saudi table UI
- Mid-period proration policies; joiner/leaver divisors
- Negative net policy enforcement; approval workflow states beyond DRAFT/POSTED/PAID
- GL posting from component mapping; dimension snapshot on JE lines
- HR payroll ops UI dashboard; rule designer UX
- Retro impact service boundary; batch BullMQ calculate
- Concurrency integration tests for Phase 5 paths

See `HCM_PHASE5_REPORT.md` for gate status.
