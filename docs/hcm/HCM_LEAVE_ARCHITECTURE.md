# HCM Leave Architecture

Policy → Enrollment → Entitlement/Accrual → **Ledger** → Balance (as-of) → Request → Approval → Occurrence → Time classification → Payroll facts (minutes, not money).

Balance is never updated as a single mutable counter on Employee/Contract for canonical flows.

See also: `HCM_LEAVE_LEDGER.md`, `HCM_LEAVE_TIME_INTEGRATION.md`, `HCM_LEAVE_PAYROLL_BOUNDARY.md`.
