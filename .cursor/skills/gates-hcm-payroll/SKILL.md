---
name: gates-hcm-payroll
description: >-
  HCM (الموارد البشرية) — payroll runs, entitlement clearance/payout, employment
  events, leave, time. Use when touching gates-backend/src/modules/hr, gates-web/app/hr,
  payroll posting, EOS/housing/leave settlements, or HR reports.
---

# HCM / payroll

Module: `gates-backend/src/modules/hr/` · UI: `gates-web/app/hr/` + `gates-web/app/components/hr/`.
Design docs: `docs/hcm/` (phase reports; `HCM_*_CURRENT_STATE.md` say what is canonical vs legacy).

## Routing rule (crash safety)

Every HR router is built with `asyncSafeRouter()` (`shared/middleware/async-handler.ts`).
Express 4 does not catch rejected async handlers and `index.ts` **exits the process on any
unhandled rejection**, so a plain `Router()` with an async handler that throws can take the
whole API down. New HR route files must use `asyncSafeRouter()`; pinned by
`src/__tests__/unit/async-safe-router.spec.ts`.

## Money flows (all post through `journalPostingService`, safe/bank caches move via GL)

| Step | Endpoint | Journal |
|---|---|---|
| Payroll accrual | `POST /hr/payroll-runs/:id/post-accrual` | Dr salaries expense … / Cr accrued payroll + deductions |
| Payroll payout | `POST /hr/payroll-runs/:id/disburse` `{safeId|bankAccountId}` | Dr accrued payroll / Cr cash |
| EOS clearance | `POST /hr/eos-clearance/clear` | Dr expense (or HR salaries expense) / Cr accrued payroll |
| Housing clearance | `POST /hr/housing-allowance/clear` | same; one per employee per month |
| Annual-leave clearance | `POST /hr/leave-entitlements/clear` | same; one per employee per year (`serial ALC-<year>`) |
| EOS / housing / leave payout | `POST /hr/{eos,housing-allowance,annual-leave}-disbursements` `{safeId|bankAccountId}` | Dr accrued payroll / Cr cash — `hr-entitlement-payout.service.ts` |
| Cancel payout | `POST …-disbursements/:id/cancel` | claim `isActive` then reverse the payout JE |

- Clearances resolve the fiscal year with `fiscalYearService.assertOpenForDate(date)` (not "latest open year").
- Duplicate clearance guard runs **inside** the transaction after `SELECT … FROM employees … FOR UPDATE`.
- HR journals have **no `JournalSourceType`**: `journalPostingService` drops unknown `sourceType`
  values (stored NULL). Identify them by `entryType` + `sourceId` — payouts `entryType: 'HrPayout'`,
  `sourceId` = disbursement id; clearances `EosClearance` / `HousingAllowance` / `AnnualLeaveClearance`,
  `sourceId` = procedure id. A non-empty `sourceId` still locks them against edits from the journal screen.
- Known, not changed: payroll posts with `sourceType: 'PR'`, which is the Auto-GL code for
  **purchase return**, so payroll journals are labelled as purchase returns. Fixing it changes
  `activeSourceKey` for posted production journals — needs its own decision.
- `JournalEntry.sourceNumber` is VarChar(30) and `sourceYearId` VarChar(20): never pass a UUID there.
- Integration tests: an empty DB cannot replay the migration chain (see
  `docs/migration/PRISMA_FRESH_INSTALL_BASELINE.md`); bootstrap a separate schema from
  `prisma migrate diff --from-empty` and run suites `--runInBand` (MySQL in the 4 GB Docker VM
  gets OOM-killed under parallel workers).
- `monthly-salary-disbursements` is a legacy record only; the UI screen `monthly-salaries-disbursement` now pays payroll runs.
- `POST /hr/leave-entitlements/disburse` is **deprecated** (writes `EmployeeContract.leaveBalance`); canonical leave is `/hr/leave/*` ledger.

## Employment changes

Transfer / promotion / suspension / termination / return-from-suspension go through HCM events
(`/hr/employment-events` draft → submit → approve; frontend helper `lib/hr/employment-events.ts`).
`approve` / `reject` / `submit` claim the status with a conditional `updateMany` (409 for the loser);
`applyEvent` re-checks status under the employment row lock. Writing `employee.departmentId`
directly does **not** move the HCM assignment or payroll eligibility.

## Legacy screens

Redirected to canonical HCM screens: annual-leave-registration & absence-permission → leave requests;
delay-permission → attendance corrections; attendance-preview → period review;
absence-overtime → attendance exceptions; employee-working-days → schedules.
Still open: `transaction-models` (letter templates) has no backend — needs a content column (migration).

## HR reports

`/hr/reports/procedures/:kind` (penalties, rewards, warnings, promotions, transfer, suspensions,
termination, secondment, courses, recommendations, housing-allowance) and `/hr/reports/loans`;
mapped in `gates-web/lib/reportPreview/resolveReportEndpoint.ts`.

## Tests

- Unit: `async-safe-router.spec.ts`, `attendance-authorize.spec.ts`
- Integration (real MySQL): `src/__tests__/integration/hcm-phase5-*.integration.spec.ts`
- E2E: `gates-web/e2e/hcm-payroll-*.e2e.spec.ts` (`E2E_AUTO_SEED=1`)
