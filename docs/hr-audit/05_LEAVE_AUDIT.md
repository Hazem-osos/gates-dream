# Leave Management — Deep Audit

## Schema

- **No** `LeaveRequest`, `LeaveType`, `LeaveBalance`, or accrual run tables.
- **Balance field:** `EmployeeContract.leaveBalance` (Decimal).
- **Events:** `EmployeeProcedure` with types such as `leave_entitlement` (via `leave-entitlements.service.ts`).

## Backend

- `leave-entitlements.service.ts` — adjusts contract `leaveBalance`, creates procedure, may interact with clearance/disbursement flows.
- **No** manager approval chain, half-day, hourly leave, calendar exclusion engine, or balance ledger.

## Frontend

- Pages: `leave-balance`, `leave-request`, `leave-types`, holidays, etc. under `app/hr/`.
- **Wiring:** leave balance / entitlements pages partially use APIs; request workflow **not** backed by dedicated request model.

## Balance source of truth

| Mechanism | Role |
|-----------|------|
| `EmployeeContract.leaveBalance` | **Stored** current balance |
| Procedures | **Audit-ish** log of entitlement actions |
| Calculated accrual | **NOT IMPLEMENTED** as scheduled job |

**Classification:** **STORED + MANUAL ADJUST** — not double-entry leave ledger.

## Flow (actual)

```
HR action (entitlement service or procedure)
  → update leaveBalance on contract
  → optional clearance/disbursement documents
  → NO attendance mark-as-leave
  → NO payroll unpaid-leave deduction from balance
```

## Feature matrix

| Feature | Status |
|---------|--------|
| Leave types (paid/unpaid) | **NOT SUPPORTED** (lookup/procedure strings only) |
| Opening balance | **PARTIAL** (manual on contract) |
| Annual entitlement / accrual | **NOT SUPPORTED** |
| Carry forward / expiry | **NOT SUPPORTED** |
| Negative balance | Possible via manual edit |
| Half-day / hourly | **NOT SUPPORTED** |
| Attachments | **NOT SUPPORTED** |
| Approval workflow | **NOT SUPPORTED** |
| Replacement employee | **NOT SUPPORTED** |
| Holiday/weekend exclusion | **NOT SUPPORTED** |
| Cancellation / restoration | **PARTIAL** (manual) |
| Payroll integration | **NOT SUPPORTED** |

## Reconciliation risks

- Balance can change without immutable ledger lines.
- No tie between leave taken and attendance `absence` records.
- Entitlement disbursement may post accounting while balance semantics unclear.

**Leave maturity:** **2/10**.
