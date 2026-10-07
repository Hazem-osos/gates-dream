# GATES HCM — PHASE 5.1 WAVE A FINAL CLOSURE REPORT

**Date:** 2026-10-07  
**Wave A.3:** executed  
**Production modified:** NO

## Regression (local, actual)

| Suite | Result |
|-------|--------|
| `hcm-phase5\|payroll-phase0\|payroll-\|hcm-concurrency` | **124/124** |
| `hcm-phase\|hcm-concurrency\|payroll-\|attendance-authorize` (broader HCM/time/leave) | **205/205** |
| Phase 0 `payroll-phase0` | **12/12** |
| `prisma validate` | PASS |
| HCM/payroll scoped `tsc` | PASS |
| Full repo `tsc` | PRE_EXISTING_FAILURE (unrelated modules; no new payroll-path errors in scoped grep) |

## Wave A.3 deliverables

- **18/18** time/leave monetary matrix (`PAYROLL_MATRIX_18` + `hcm-phase5-wave-a3.integration.spec.ts`)
- Wildcard one-time input (`period 0/0`) + snapshot `oneTimeInputIds` + true two-run approve race
- HTTP security tests (`hcm-phase5-permissions-http.integration.spec.ts`)
- Route guards: `payroll:post`, `payroll:pay`, `PATCH .../components/:id/gl` → `payroll:gl_manage`
- BullMQ handler extracted (`processHcmPayrollCalculateJob`) with idempotency IT (no Redis required for gate)
- GL cross-company rejection via `updateComponentGlAccounts`
