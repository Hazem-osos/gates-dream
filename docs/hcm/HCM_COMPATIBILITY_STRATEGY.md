# HCM Compatibility Strategy

**Direction:** canonical HCM → legacy projection (one-way).

| Legacy field | Owner | Sync |
|--------------|-------|------|
| `Employee.departmentId` | `HcmEmploymentAssignment` (current) | `hcmCompatibilityService.syncEmployeeProjection` |
| `Employee.jobTitleId` | Current assignment | same |
| `Employee.costCenterId` | From current `HcmPosition` if set | same |
| `Employee.basicSalary` | `HcmCompensationAssignment` (current) | same |
| `Employee.fixedAllowances` | Current compensation | same |
| `PayrollRun` calculation | **Still reads `Employee.*`** | Unchanged Phase 1 |

Triggers for projection sync:

- HCM backfill (`POST /hr/hcm/backfill-employment`)
- `hcmTransitionService.transitionAssignment`
- `hcmTransitionService.transitionCompensation`

**Not synced:** bidirectional edits on Employee master form alone do not update HCM assignments (until Phase 2 wires procedures).
