# HCM Target Architecture (Recommendation — Not Implemented)

This section describes a **target** shape informed by gaps. It does not change the codebase.

## Layered model

```
┌─────────────────────────────────────────────────────────┐
│  ESS / MSS (employee + manager scoped APIs)              │
├─────────────────────────────────────────────────────────┤
│  HR Core: Person, Employment (effective-dated), Org      │
├─────────────────────────────────────────────────────────┤
│  Time: Shifts, Roster, Raw punches, Processed time       │
├─────────────────────────────────────────────────────────┤
│  Leave: Policy, Balance ledger, Requests, Approvals        │
├─────────────────────────────────────────────────────────┤
│  Pay: Component library, Assignment, Calc engine, Run    │
├─────────────────────────────────────────────────────────┤
│  Talent: ATS, Performance, Learning (optional modules)   │
├─────────────────────────────────────────────────────────┤
│  Platform: Workflow, Documents, Notifications, Audit     │
└─────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   Accounting GL         Treasury / payments
```

## Preserve from current Gates

- Tenant `companyId` on all HR entities.
- `PayrollRun` + journal posting pattern (extend, do not rewrite GL integration).
- `EmployeeAdvance` recovery semantics.
- Lookup masters and `HrSettings` account mapping.

## Employment truth

Introduce **EmploymentAssignment** (or equivalent) with:

- `employeeId`, `effectiveFrom`, `effectiveTo`
- `departmentId`, `jobTitleId`, `costCenterId`, `branchId`, `managerId`
- `basicSalary`, component snapshot or FK to compensation rows

Keep `Employee` as **person**; demote current job fields to "current view" materialized or computed.

## Payroll truth

- Single run entity (`PayrollRun` retained).
- **PayComponent** + **EmployeePayAssignment** with effective dates.
- Rule evaluation in isolated engine (testable); `WagePolicy.rules` migrated to structured rules or deprecated.
- Time/leave inputs as **locked inputs** on run snapshot when period closes.

## Workflow

- Reuse global `/api/v1/approval` with HR document types (leave, attendance correction, pay adjustment).

## Localization

- `CountryPack` interface: tax, SI, weekends, ID validators, public holidays.
- Egypt pack extracts current `HrSettings` defaults.

## Data / AI readiness

- Stable IDs, effective dating, event stream for employment changes.
- Avoid critical business rules in JSON blobs without schema version.

## Biggest architectural problems (current → target)

1. Two payroll tracks → one.
2. No effective dating → employment history layer.
3. UI surface without backend → contract-first APIs per domain.
4. Global allowance sum → per-employee assignments.
5. Attendance disconnected from pay → processed time as payroll input.
