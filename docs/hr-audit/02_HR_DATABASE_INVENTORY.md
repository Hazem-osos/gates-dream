# HR Database / Prisma Inventory

**Source:** `gates-backend/prisma/schema.prisma` (verified 2026-10-05).

## Summary counts

| Category | Count |
|----------|------:|
| Core HR / payroll models | **24** (listed below) |
| Models with `companyId` | 22/24 (all except join-only children scoped via parent) |
| Models with `branchId` | 1 (`PayrollRun` only) |
| Models with soft delete | **None** (HR uses `isActive` flags) |

## Model catalog

Legend: **Usage** = evidence from backend routes/services (not UI alone).

### Core employment

| Model | Table | companyId | branchId | Purpose | Usage | Risks |
|-------|-------|-----------|----------|---------|-------|-------|
| `Employee` | employees | ✅ | ❌ | Person + current job/salary snapshot | **WORKING** | No manager, no branch; salary overwrite |
| `EmployeeContract` | employee_contracts | via employee | ❌ | Contract terms, org placement, leaveBalance | **WORKING** | `sectionId` **no Section model**; multiple active not enforced in schema |
| `EmployeeProcedure` | employee_procedures | via employee | ❌ | Event log (warning, transfer, …) | **WORKING** | No structured payload; `procedureType` string |
| `EmployeeAdvance` | employee_advances | via employee | ❌ | Salary advance + installments | **WORKING** | Recovery in payroll engine FIFO |

### Payroll

| Model | companyId | branchId | Purpose | Usage |
|-------|-----------|----------|---------|-------|
| `HrSettings` | ✅ unique | ❌ | GL account codes + SI/tax rates | **WORKING** |
| `PayrollRun` | ✅ | optional | Monthly run header, totals, journal IDs | **WORKING** |
| `PayrollRunItem` | via run | ❌ | Per-employee calc snapshot | **WORKING** |
| `MonthlySalary` | ✅ | ❌ | Legacy/monthly salary document | **WORKING** (parallel track) |

### Entitlements (clearance + disbursement)

| Model | Purpose | Usage |
|-------|---------|-------|
| `HousingAllowanceClearance` | Housing allowance calculation snapshot | **BACKEND** + some UI |
| `EndOfServiceClearance` | EOS accrual snapshot | **BACKEND** |
| `AnnualLeaveEntitlementsClearance` | Leave entitlement valuation | **BACKEND** |
| `EndOfServiceDisbursement` | EOS payment event | **BACKEND** |
| `AnnualLeaveEntitlementsDisbursement` | Leave entitlement payout | **BACKEND** |
| `HousingAllowanceEntitlementsDisbursement` | Housing payout | **BACKEND** |

### Lookups & policy

| Model | companyId | Unique | Purpose |
|-------|-----------|--------|---------|
| `Nationality` | ✅ | company+code | Lookup |
| `Religion` | ✅ | company+code | Lookup |
| `MaritalStatus` | ✅ | company+code | Lookup |
| `JobTitle` | ✅ | company+code | Lookup |
| `JobCadre` | ✅ | company+code | Lookup |
| `Department` | ✅ | company+code | Dept + self-ref `managementId` |
| `City` | ✅ | company+code | Lookup |
| `WagePolicy` | ✅ | company+code | JSON `rules` (not used in payroll engine) |
| `Allowance` | ✅ | company+code | Master; defaultAmount |
| `Deduction` | ✅ | company+code | Master; defaultAmount |
| `HrLookup` | ✅ | kind index | Qualifications, doc types, tickets, … |
| `HrAttendanceRecord` | ✅ | kind index | Polymorphic attendance MVP |

## Field highlights

### Money

- `Decimal(15,2)` on salaries; `Decimal(8,6)` on rates in `HrSettings`.
- No separate currency on employee pay (company currency assumed).

### Audit

- `createdAt` / `updatedAt` on most masters.
- `EmployeeProcedure.createdBy` only on procedures — **no updatedBy** on employee.
- No row-level history tables.

### Indexes

- Standard `companyId`, `employeeId`, date indexes present.
- No composite uniqueness on employee serial at DB level (app may enforce).

## Orphan / duplicate concepts

| Issue | Detail |
|-------|--------|
| `EmployeeContract.sectionId` | **No `Section` model** — field unused or free-text FK risk |
| `Employee` vs `EmployeeContract` | Org/salary duplicated (employee has basicSalary; contract has own) |
| `Allowance`/`Deduction` masters | Not linked to employees — engine sums **all active** company defaults |
| `WagePolicy.rules` | Stored JSON; **payroll-engine does not read it** |
| Two payroll stores | `PayrollRun*` vs `MonthlySalary` |
| Attendance | One table, many `kind` values — not normalized punch/shift tables |

## Enums vs strings

- `PayrollRun.status` — `VarChar(20)` string (`DRAFT`, etc.) not Prisma enum.
- `EmployeeProcedure.procedureType` — free string (`transfer`, `penalty`, `leave_entitlement`, …).
- `HrAttendanceRecord.kind` — constrained in route Zod only (`shift`, `holiday`, `sheet`, …).

## Legacy migration

- No dedicated `docs/migration/*HR*` catalog in repo search; HR appears **native Gates** schema, not migrated ETL module in this tree.
- Compare `docs/migration/LEGACY_*` only if legacy SQL Server HR tables exist externally — **not wired in this codebase audit**.

## UI–schema gaps

- Employee document tab uses **static DOCUMENT_SEED** in UI — no `EmployeeDocument` model.
- `employee-files` page — verify separately; no Prisma model found.
- Training course pages post as **procedures**, not training entities.
