# HCM Phase 1 Report

**Production modified:** NO (code + migration file only; deploy separately)

## Delivered

| Area | Status |
|------|--------|
| Organization (`Department.unitType`, section FK) | Done |
| `HcmPosition` | Done |
| `HcmEmployment` | Done |
| `HcmEmploymentAssignment` | Done |
| `HcmCompensationAssignment` | Done |
| Domain transitions + overlap rules | Done |
| Compatibility projection | Done |
| Backfill `POST /hr/hcm/backfill-employment` | Done |
| Employee 360 API + UI | Done |
| Positions list UI | Done |
| Canonical payslip read `GET /hr/hcm/canonical-payslips` | Done |
| `compensation` permission | Done |
| Legacy `/hr/payroll/calculate` marked deprecated | Done |

## MonthlySalary consumers (remaining legacy)

| Consumer | Action |
|----------|--------|
| `monthly-salary.service` CRUD | Keep |
| `payroll.processor` BullMQ | Deprecated calc path |
| `monthly-salaries` UI | Legacy register |
| `reports.service` | Batch read |
| `hr-payroll.tool` | Aggregate |

New UI: prefer `PayrollRun` / canonical payslip endpoint.

## Migration

`prisma/migrations/20261005180000_hcm_phase1_foundation/migration.sql`

Run `prisma migrate deploy` in each environment before using HCM APIs.

## Tests

- `hr-effective-date.util.spec.ts` (unit)
- `hcm-phase1.integration.spec.ts`
- `payroll-phase0.integration.spec.ts` (regression gate)

## Ready for Phase 2

Wire approved procedures → `transitionAssignment` / `transitionCompensation`; optional payroll input from compensation at period date.
