# HCM Leave Ledger

Canonical store: `HcmLeaveLedgerEntry` with unique `(companyId, sourceKey)` for idempotency.

Transaction types: OPENING, ENTITLEMENT, ACCRUAL, CARRY_FORWARD, ADJUSTMENT_CREDIT/DEBIT, LEAVE_TAKEN, LEAVE_REVERSAL, EXPIRY, ENCASHMENT, FORFEITURE, MIGRATED_OPENING_BALANCE.

Balance = sum of signed ledger quantities − reserved quantities on SUBMITTED requests without LEAVE_TAKEN.

Service: `leave-balance.service.ts` → `getLeaveBalance(employmentId, leaveTypeId, asOfDate)`.
