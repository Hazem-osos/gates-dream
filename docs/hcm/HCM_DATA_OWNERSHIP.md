# HCM Data Ownership (Source of Truth)

| Domain | Current SoT (Phase 0) | Future SoT |
|--------|------------------------|------------|
| Person identity | `Employee` (person fields) | `Employee` |
| Employment relationship | Implicit (`Employee.companyId`, `hireDate`/`joinDate`) | `Employment` |
| Organization assignment | `Employee.departmentId` (+ contract branches) | `EmploymentAssignment` |
| Manager | **None** | `EmploymentAssignment.managerId` |
| Position / headcount | **None** | `Position` + `PositionAssignment` |
| Job title (definition) | `JobTitle` lookup | `JobTitle` |
| Compensation definition | `Employee.basicSalary`, `fixedAllowances` + global masters | `CompensationAssignment` + component links |
| Legal contract | `EmployeeContract` | `EmployeeContract` (versioned) |
| Attendance | `HcmAttendanceDay` (+ legacy `HrAttendanceRecord` read-only) | `HcmAttendanceDay` |
| Leave balance | `HcmLeaveLedgerEntry` (derived as-of) | Same; `EmployeeContract.leaveBalance` legacy read-only / migrated opening |
| Payroll **calculation** | `payroll-engine.service` → `PayrollRun` | Same engine, richer inputs |
| Historical payroll result | `PayrollRunItem` after post | `PayrollRunItem` + component lines |
| Payslip register (parallel) | `MonthlySalary` | **Derived** from posted run or deprecated |
| Accounting posting | `PayrollRun.accrualJournalEntryId`, `paymentJournalEntryId` | Unchanged |
| Advances | `EmployeeAdvance` | Unchanged |
| HR GL config | `HrSettings` per company | `HrSettings` + localization pack |
| Procedures / discipline | `EmployeeProcedure` | Event log + workflow (not SoT for org/pay) |
| Section | `Department` child via `managementId`; orphan `sectionId` on contract | Formal `OrganizationalUnit` or child dept only |

## Section vs department

- **Management (إدارة):** `Department` where `managementId IS NULL` (roots).
- **Department / Section:** same table — child row with `managementId` pointing to parent.
- **`EmployeeContract.sectionId`:** legacy/orphan — **do not use** until modeled or removed in Phase 1.

## JobTitle vs Position

- **JobTitle:** catalog label (what kind of job).
- **Position:** org slot (where in hierarchy, headcount, vacancy) — **to be added** (Phase 1 design).
