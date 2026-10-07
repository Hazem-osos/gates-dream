# Payroll → Accounting Integration

## Services

- `payroll-posting.service.ts` — primary integration.
- `hr-gl-account-resolver.service.ts` — maps `HrSettings` account codes to GL accounts.
- Uses `journalPostingService` + `documentSequenceService` (GL numbers).
- Payment leg: `treasuryAccountResolverService` for bank/cash account.

## Accrual flow (evidence)

1. Load `PayrollRun` (must be `DRAFT` for accrual post — see status checks).
2. Build journal lines from run totals (salary expense, employer SI, payables, tax, SI payable, etc.).
3. Persist journal reference on run (`accrualJournalId` pattern — verify field names in schema).
4. `applyAdvanceRecoveries` updates `EmployeeAdvance.remainingAmount` inside transaction.

## Reversal

- `reverseAdvanceRecoveries` — LIFO restore of advance balances when reversing payment/accrual (documented in service).
- Journal reversal via accounting module patterns — **treat as PARTIAL** until full idempotency tested.

## Allocation dimensions

| Dimension | Payroll posting |
|-----------|-----------------|
| Company | ✅ `companyId` |
| Branch | ⚠️ `PayrollRun.branchId` optional — line allocation unclear |
| Department | ❌ Not in engine totals |
| Cost center | ❌ Employee has `costCenterId` — not split in engine |
| Project | ❌ |
| Employee | ✅ Per `PayrollRunItem` detail; GL may aggregate |

## Clearance / disbursement posting

- `end-of-service-clearance.service.ts`, `housing-allowance-clearance.service.ts`, `annual-leave-entitlements-clearance.service.ts` — separate journal paths.
- Entitlement **disbursement** routes — payment posting.

## Quality attributes

| Attribute | Assessment |
|-----------|------------|
| Atomic | ✅ Uses Prisma transactions in posting service |
| Idempotent | **PARTIAL** — depends on status guards; retry behavior not fully audited |
| Reversible | **PARTIAL** — reversal helpers exist for advances |
| Audited | Journal + run status; no dedicated payroll audit log |

## Double-post risks

- Parallel `MonthlySalary` disbursement vs `PayrollRun` post — **DUPLICATION RISK** if both used for same period.
- Advance recovery on accrual post — reversing run must run paired reversal (implemented in service; ops discipline required).

**Payroll → Accounting:** **PARTIAL / YES for PayrollRun path** when HR settings configured.
