# HCM Leave — Current State (Phase 4 audit)

## Classification summary

| Area | Decision | Notes |
|------|----------|-------|
| `EmployeeContract.leaveBalance` | **LEGACY_READ_ONLY** | May seed `MIGRATED_OPENING_BALANCE` ledger only |
| `leave-entitlements.service.ts` | **DEPRECATE** | Mutates contract balance; do not use for new flows |
| `EmployeeProcedure.leave_entitlement` | **LEGACY_READ_ONLY** | Historical audit |
| Annual leave clearance/disbursement | **KEEP** | EOS/settlement documents; not canonical leave ledger |
| `absence-permission` / `delay-permission` UI | **DEPRECATE** | Replace with canonical leave requests + Time overlay |
| `company-leave-days-definition` | **EVOLVE** | Prefer `HcmCalendarDay` + schedule (Phase 3) |
| Phase 3 Time engine | **KEEP** | Leave classifies days; no punch fabrication |
| `PayrollRun` / manual absence | **KEEP** | Unchanged; facts via `TimePayrollReadService` extension |

## Canonical (Phase 4)

- `HcmLeaveType`, `HcmLeavePolicy`, `HcmLeavePolicyRule`, `HcmLeaveEnrollment`
- `HcmLeaveLedgerEntry` (source of truth)
- `HcmLeaveRequest` / `HcmLeaveRequestDay`
- `HcmLeaveAccrualRun`
- API: `/api/v1/hr/leave/*`

## Migration

- Idempotent bootstrap: `hcmLeaveSetupService`
- Contract balance → `MIGRATED_OPENING_BALANCE` when present and employment linked
- No fabricated entitlement history
