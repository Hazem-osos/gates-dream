# Organization Structure & Employee 360

## Current hierarchy (evidence-based)

```
Company (tenant)
├── Department (flat list + optional parent via managementId = "إدارة")
│   └── "Section" = child Department row (same table, managementId set) — NOT a separate entity
├── JobTitle (lookup)
├── JobCadre (lookup)
├── CostCenter (accounting module; optional on Employee / Contract)
├── Branch (core module; on Contract workBranchId / salaryBranchId only)
└── Employee (current snapshot)
    ├── departmentId → Department
    ├── jobTitleId → JobTitle
    ├── costCenterId → CostCenter
    └── EmployeeContract[] (terms, branches, sectionId orphan field)
```

**Not modeled on Employee:** `branchId`, `managerId`, `positionId`, `grade`, `jobFamily`, team, dotted-line.

## Capability matrix

| Capability | Status | Evidence |
|------------|--------|----------|
| Multiple branches | **SUPPORTED** (company) | Core `Branch`; payroll run optional `branchId` |
| Employee belongs to branch | **NOT SUPPORTED** on master | Only contract branches |
| Cross-branch employee | **PARTIAL** | Contract fields only |
| Department hierarchy | **PARTIAL** | One level: management → department via `managementId` |
| Positions independent of employees | **NOT SUPPORTED** | No Position model |
| Vacant positions | **NOT SUPPORTED** | |
| Multiple employees per position | N/A | |
| Manager hierarchy | **NOT SUPPORTED** | |
| Dotted-line reporting | **NOT SUPPORTED** | |
| Job grades / families | **NOT SUPPORTED** | `JobCadre` is coarse lookup only |
| Headcount planning | **NOT SUPPORTED** | |

## Employee 360 — what is stored

### Personal & contact (`Employee`)

- Names (AR/EN), serial, employeeId, nationalId, passport, birth date, gender, nationality, religion, marital status, address, phones, email, photo URL, notes.

### Employment (current only)

- `hireDate`, `isActive`, `departmentId`, `jobTitleId`, `costCenterId`, optional `userId`.

### Compensation (current only)

- `basicSalary`, `fixedAllowances` (Decimal) — **no component breakdown table**.

### Banking / government

- Bank name, account, IBAN — on employee; contract may duplicate wage terms.

### Contract (`EmployeeContract`)

- Dates, probation, wage policy link, insurance flags, leave balance, work/salary branch, cost center, basic + allowances on contract row.

### Education / experience / skills

- **No dedicated tables** — UI may use `HrLookup` or procedures only.

### Documents

- **UI seed only** — no persisted HR document model in Prisma HR block.

### History tables

- `EmployeeProcedure` — narrative events (transfer, penalty, leave_entitlement, …) with date, amount, reason.
- **Does not** auto-update `Employee.departmentId` on transfer (`employee-procedure.service.ts` create only inserts procedure).

## Effective dating — critical answers

| Question | Answer |
|----------|--------|
| Salary 20k → 25k history? | **NO** — `Employee.basicSalary` overwritten; contract row may be edited; no salary history table |
| Department move 6 months ago? | **PARTIAL** — if `transfer` procedure logged with correct metadata; **employee row not auto-updated** from procedure |
| Manager change history? | **NO** — no manager field |
| Position change history? | **PARTIAL** — procedure log only |
| True effective-dated HR? | **NO** (current snapshot + event log) |

**Classification:** **OVERWRITE + OPTIONAL EVENT LOG**, not bitemporal employment.

## Employment lifecycle (summary)

| Stage | DB | Backend | UI | Updates master | Approval | Accounting |
|-------|-----|---------|-----|----------------|----------|------------|
| Hire | Employee + Contract | ✅ | ✅ | ✅ | ❌ | ❌ |
| Onboarding | — | ❌ | UI shells | — | ❌ | ❌ |
| Probation | contract fields | ✅ | ✅ | manual | ❌ | ❌ |
| Confirmation | procedure? | log only | forms | ❌ | ❌ | ❌ |
| Transfer | procedure | ✅ | ✅ | ❌ | ❌ | ❌ |
| Promotion | procedure | ✅ | ✅ | ❌ | ❌ | ❌ |
| Salary change | employee/contract | ✅ | partial | overwrite | ❌ | ❌ |
| Suspension / termination | procedure | ✅ | ✅ | ❌ | ❌ | EOS paths **PARTIAL** |
| Final settlement | clearances | ✅ | ✅ | ❌ | ❌ | **PARTIAL** (posting services) |
| Rehire | manual | ✅ | ✅ | overwrite | ❌ | ❌ |

Maturity: **D–C** for lifecycle (logging without state machine).
