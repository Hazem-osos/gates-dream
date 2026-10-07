# HCM Implementation Roadmap (Recommended Phases)

**Dependency-first.** Durations are relative effort, not calendar estimates.

## Phase 0 — Foundations (correctness & security)

- Document single payroll path decision (`PayrollRun` vs `MonthlySalary`).
- Add HR integration tests: payroll run calc, accrual post, advance recovery + reversal.
- Audit all HR routes for `companyId` scoping.
- Field-level permission design for salary/bank/nationalId.
- **Gate:** no Phase 5 payroll rule work without tests.

## Phase 1 — Organization + Employee 360

- Branch + manager on employment record (even before full effective dating).
- Employee 360 API (person + current employment + open advances + last payslip).
- Wire or remove dead HR pages (inventory of 76 routes).
- Document entity + link to platform attachments.

## Phase 2 — Effective-dated employment & contracts

- Employment history table; migrate from `Employee` job/salary fields.
- Contract renewal workflow; probation alerts.
- Procedures: either supersede with employment events or sync master on approve.

## Phase 3 — Time architecture

- Shift/schedule masters.
- Immutable punch ingest + processed daily attendance.
- Bridge to payroll as optional inputs (overtime, absence).

## Phase 4 — Leave

- Leave types, policies, balance ledger.
- Request + approval (workflow module).
- Integration with attendance and payroll (unpaid leave).

## Phase 5 — Payroll rule engine

- Component library and per-employee assignment.
- Replace global allowance sum; implement or parse `WagePolicy` rules.
- Period lock on posted runs (harden beyond DRAFT).

## Phase 6 — Payroll accounting hardening

- Cost center / branch allocation on journal lines.
- Idempotent post endpoints; reconciliation reports.
- Deprecate duplicate monthly salary posting if merged.

## Phase 7 — ESS / MSS

- Employee payslip, leave, attendance view.
- Manager approvals and team calendar.

## Phase 8 — Recruitment & onboarding

- ATS minimal viable; hire → employee conversion.

## Phase 9 — Performance & compensation

- Review cycles; optional link to pay components.

## Phase 10 — Learning & skills

- Courses, certifications, expiry notifications.

## Phase 11 — Analytics & workforce planning

- Headcount, turnover, payroll cost dashboards from unified model.

## Phase 12 — Localization & AI

- Egypt pack extraction; second country pilot.
- Structured exports for AI tools (extend `HrPayrollTool`).

## Estimated scope

**VERY LARGE** (multi-quarter program with current 3.5/10 maturity).

## Ready to start implementation?

**NO** — complete first:

1. Owner decision: **PayrollRun vs MonthlySalary** canonical path.
2. Owner decision: **procedure vs employment history** for transfers/promotions.
3. Phase 0 test harness + permission model sign-off.

Then **YES** for Phase 0–1 in parallel with product design for time/leave.
