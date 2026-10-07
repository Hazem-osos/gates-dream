# Legacy Leave Write Audit (Phase 4.1)

| Consumer | Classification |
|----------|----------------|
| `leave-entitlements.service` → `EmployeeContract.leaveBalance` | **STILL_WRITING** (legacy disbursement; not used by HCM Leave engine) |
| `employee-contract.service` leaveBalance on create/update | **STILL_WRITING** (contract maintenance; not canonical leave) |
| HCM `/api/v1/hr/leave/*` | **CANONICAL** — ledger only |
| `absence-permission`, `delay-permission` pages | **DEPRECATED** — legacy attendance POST |
| `company-leave-days-definition` | **DEPRECATED** — prefer `HcmCalendarDay` |
| `hcmLeaveSetupService` migrated opening | **CANONICAL_REPLACED** — one-time ledger OPENING |

**New HCM Leave workflows: 0 writes to `EmployeeContract.leaveBalance`.**
