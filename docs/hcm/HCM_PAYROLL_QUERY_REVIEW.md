# Payroll query review (Wave B)

## Payroll runs list
- `payrollRunReadService.listRuns`: single `findMany` + `count` with pagination; no per-row queries.

## Run review
- One `findFirst` with `items.components` and `employee` included; reconciliation + GL mapping batch per run (not per employee).

## Reports
- `loadRun` single include for all report types; aggregation in memory per run (acceptable for run-scoped reports).

## Employee 360 payroll history
- Existing bounded `take: 20` on payroll run items; amounts optional via `includePayrollAmounts`.

## 1,000+ employee read check (methodology)
- Synthetic scale not executed in CI; list endpoint uses `pageSize` max 100 and server-side pagination.
- Review finding: no N+1 in new read paths; full-company report without run id remains out of scope (run-scoped only).
