# HCM Effective Dating (Design — Phase 0)

**Not implemented in Phase 0.** This document locks the **target** employment model.

## Problem today

- `Employee.departmentId`, `basicSalary`, `jobTitleId`, etc. are **mutable current state**.
- `EmployeeProcedure` records events but **does not** authoritatively close/open assignments.
- `EmployeeContract` holds terms but overlaps and history are not first-class.

## Concepts

| Concept | Definition |
|---------|------------|
| **Employee** | Person identity (names, IDs, contact, bank) — **atemporal** |
| **Employment** | Legal relationship `{ employeeId, companyId, hireDate, terminationDate?, status }` |
| **EmploymentAssignment** | Org placement effective `[effectiveFrom, effectiveTo]` — dept, branch, manager, cost center |
| **PositionAssignment** | Link to **Position** slot (optional headcount) effective-dated |
| **CompensationAssignment** | Pay components effective-dated (basic, allowances, enrolled flags) |
| **EmployeeContract** | Legal document versions (may reference compensation assignment IDs) |

## Authoritative answers (target)

| Question | Source |
|----------|--------|
| Department on 2026-03-01? | `EmploymentAssignment` row where date ∈ [from, to] |
| Salary on that date? | `CompensationAssignment` |
| Manager? | `EmploymentAssignment.managerEmployeeId` or `Position.reportsToPositionId` |
| Contract terms? | `EmployeeContract` version effective on date |

## Overlap rules

- **At most one open** primary `EmploymentAssignment` per employment (no overlapping `[from,to]`).
- **CompensationAssignment** same rule per employment.
- Closing assignment: set `effectiveTo` = day before new `effectiveFrom`.
- Procedures remain **audit**; approved workflow creates assignment rows (Phase 2+).

## Compatibility (transition)

- Keep `Employee.departmentId` / `basicSalary` as **cached current view** maintained by application layer when assignments change — until all readers migrate.
- Mark fields `@deprecated` in docs; do not delete in Phase 0.

## Procedure → state (future)

```
APPROVED procedure (transfer/promotion/salary change)
  → close current assignment(s) at effectiveTo
  → insert new assignment(s) at effectiveFrom
  → refresh Employee cache fields
  → optional: emit domain event for payroll “locked inputs”
```

Phase 0: **design only** — no new tables unless security fix requires.
