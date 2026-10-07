# HCM Domain Map

Dependencies: **↑** consumes data from.

| Domain | Status | Depends on | Notes |
|--------|--------|------------|-------|
| **Core HR** | Working | Company tenant | Employee, lookups |
| **Organization Management** | Partial | Core HR | Dept/management; no Position |
| **Employment** | Missing (design) | Core HR, Org | Effective-dated assignments |
| **Compensation** | Partial | Employment | Employee fields + global masters |
| **Time & Attendance** | **Canonical (Phase 3)** | Employment, schedules | `HcmTimePunch` → `HcmAttendanceDay` |
| **Leave** | **Canonical (Phase 4)** | Employment, Time calendar | `HcmLeaveLedgerEntry` + requests |
| **Payroll** | Working (PayrollRun) | Compensation, HrSettings, Advances | MonthlySalary parallel |
| **Benefits** | Missing | Compensation | |
| **Recruitment** | Missing | Org, Position (future) | |
| **Onboarding** | UI only | Employment | |
| **Performance** | Missing | Employment | |
| **Learning** | Procedure log | Core HR | |
| **Talent / Succession** | Missing | Position, Performance | |
| **Employee Services** | Missing | Payroll, Leave | |
| **Workforce Planning** | Missing | Position, Org | |
| **HR Analytics** | Partial | Payroll register, procedures | |
| **Localization** | Egypt defaults | Payroll, HrSettings | |
| **Accounting bridge** | Working | Payroll | Accrual + pay |
| **Treasury bridge** | Working | Payroll disburse | |

## Implementation order (reference)

```
Phase 0 lock + tests
  → Phase 1 Org + Employee 360 + Position design
  → Phase 2 Employment effective dating
  → Phase 3 Time
  → Phase 4 Leave
  → Phase 5 Pay components / rule engine
  → Phase 6 GL hardening
  → Phase 7+ talent & ESS
```

## Organization target hierarchy

```
Company
└── Branch (operational)
    └── Management (Department root, managementId = null)
        └── Department / Section (same table, child via managementId)
            └── Position (future: slot with job title, grade, CC, manager position)
                └── EmploymentAssignment (employee fills position for date range)
```

**JobTitle** = catalog; **Position** = instance in org tree.
