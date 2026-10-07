# Employee 360 (Phase 1)

## API

`GET /api/v1/hr/employees/:id/360`

- Requires `employee:view`.
- Compensation block requires `compensation:view` **or** `payroll:view`.

`GET /api/v1/hr/employees/:id/assignment-at?date=YYYY-MM-DD`

Historical assignment + compensation at date.

## UI

`/hr/employee-360` — picker + overview tab (employment, org path, manager position, payroll source).

Tabs for attendance/leave/documents show `modules.*.available=false` from API.

## Payroll truth in 360

`payroll.canonicalSource = PayrollRun`; last posted `PayrollRunItem` referenced when present.

Legacy `MonthlySalary` not shown as financial truth in 360.
