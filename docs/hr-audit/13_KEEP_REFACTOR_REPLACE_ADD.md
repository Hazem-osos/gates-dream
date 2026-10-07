# Keep / Refactor / Replace / Add

Principle: **preserve working payroll and master data paths**; do not discard `Employee`/`Contract` without migration plan.

## KEEP

| Subsystem | Why |
|-----------|-----|
| `Employee` + `EmployeeContract` masters | Core data; UI and APIs production-used |
| HR lookups (`Department`, `JobTitle`, …) | Stable tenant masters |
| `HrSettings` + GL resolver | Payroll posting depends on it |
| `EmployeeAdvance` + recovery in posting | Working money logic with reversal |
| `HrMasterLookupPage` pattern | Consistent CRUD UX |
| `employee-data` / `employee-contract` pages | E2E quality |
| `reports.service.ts` | Business reporting investment (refactor later, not replace) |

## KEEP + EXTEND

| Subsystem | Extension |
|-----------|-----------|
| `PayrollRun` + `payroll-posting` | Become single payroll source of truth |
| `EmployeeProcedure` | Add structured payload OR migrate to employment events |
| `HrAttendanceRecord` | Keep as raw/event store if building T&A engine above |
| Permissions | Add HR-scoped roles + field policies |
| `Employee.userId` | Hook for ESS |

## REFACTOR

| Subsystem | Why |
|-----------|-----|
| `payroll-engine.service.ts` | Per-employee components; read `WagePolicy.rules` or new rule tables |
| Allowance/deduction assignment | Stop summing all company defaults for every employee |
| Lifecycle forms | Either update `Employee`/`Contract` in same transaction as procedure OR rename as "requests" |
| `attendance.routes.ts` | Move to service; pagination; immutability for punches |
| Dual payroll (`MonthlySalary` vs `PayrollRun`) | Consolidate UX and APIs |
| Large `reports.service.ts` | Split by domain |

## REPLACE

| Subsystem | Why |
|-----------|-----|
| Leave balance on contract only | Replace with ledger + requests when building real leave |
| Static document UI seeds | Replace with document service + templates |
| Global flat tax/SI in settings only | Replace with localization packs (keep settings as fallback) |

**Do not replace:** Prisma `Employee` table wholesale — evolve with history tables.

## REMOVE / DEPRECATE

| Item | Why |
|------|-----|
| Unused attendance UI shells | After T&A designed, delete or wire |
| `payroll` async job path | If redundant with PayrollRun — deprecate with migration |
| Orphan `sectionId` without model | Remove or add Section entity |

## ADD NEW

| Capability | Priority |
|------------|----------|
| Employment history (effective-dated) | P1 |
| Organization: branch on employee, manager | P1 |
| Leave request + policy engine | P2 |
| Time: shifts, roster, punch pipeline | P2 |
| Payroll component assignment + formulas | P2 |
| Workflow integration for HR | P2 |
| ESS / MSS portals | P3 |
| ATS, performance, LMS | P4+ |
| Localization packs | P4+ |
| HR document generation (PDF, AR/EN) | P3 |
