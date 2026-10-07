# HR Technical Debt & Quality

Scope: `gates-backend/src/modules/hr/**`, `gates-web/app/hr/**`, `gates-web/app/components/hr/**`.

## Service / file size

- `reports.service.ts` — large aggregation surface (maintainability risk).
- `employee.service.ts`, contract services — moderate.
- `payroll-engine.service.ts` — small but **central**; should not grow ad-hoc.

## Duplication

- Payroll: `PayrollRun` vs `MonthlySalary` vs BullMQ job.
- Allowance/deduction: global sum vs per-employee expectation.
- Lifecycle: many similar form pages → same `employee-procedures` API.
- Reports vs operations data entry.

## Frontend anti-patterns

- Payroll math **not** in frontend (good).
- Some forms hardcode dates (`2025-11-26` defaults).
- **76 pages** vs **~13** React Query integrations — drift risk.
- `limit: 500` on employee/department lists — **unbounded growth**.

## Backend anti-patterns

- `attendance.routes.ts` — logic in route file, `take: 200`.
- `procedureType` magic strings — no enum contract across UI/backend.
- `EmployeeProcedure` does not drive state machine on `Employee`.

## Data integrity

- No transactions linking transfer procedure → employee department update.
- Advance recovery coupled to payroll post — correct but requires ops discipline on reversal.
- Floating money: `Decimal` in Prisma — **good**; `Number()` in engine — watch rounding (`roundTo4` in posting).

## Concurrency

- Payroll run creation checks existing run for period — `payroll-engine.service.ts` status guard.
- No distributed lock on monthly salary + payroll run for same month.

## Tests

- **No** `modules/hr/**/*.spec.ts` found.
- Tangential AI tool tests only.

## Missing validation

- Multiple active contracts per employee — business rule unclear.
- Section ID without Section table.

## Audit logging

- Platform audit may exist globally — HR-specific employment change log **weak** (procedures optional).

## Notifications / cron

- No HR cron jobs found in hr module (contract expiry, probation).
- BullMQ payroll processor only.

## N+1 / pagination

- Employee list endpoints — verify pagination in `employee.routes.ts` (audit: use list with limit; full scan risk).

**Priority debt:** unify payroll tracks, wire procedures to master updates or replace with employment history, add tests around payroll post + advance recovery.
