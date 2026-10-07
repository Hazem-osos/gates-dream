# HCM Organization Model (Phase 1)

## Decision: **EVOLVE DEPARTMENT** (not a separate OrganizationUnit table)

`Department` remains the org-unit table with Phase 1 additions:

| Field | Purpose |
|-------|---------|
| `managementId` | Parent org unit (existing hierarchy) |
| `unitType` | `MANAGEMENT` \| `DEPARTMENT` \| `SECTION` |
| `branchId` | Optional branch scope |
| `managerPositionId` | Optional link to `HcmPosition` |

### Hierarchy (canonical)

```
Company
└── Branch (optional on unit)
    └── Department (unitType=MANAGEMENT, managementId=null)
        └── Department (unitType=DEPARTMENT)
            └── Department (unitType=SECTION)
                └── HcmPosition (slot)
```

### Section orphan resolved

`EmployeeContract.sectionId` now has FK → `departments.id` (`ContractSection` relation).  
Sections are **child departments** with `unitType=SECTION`.

### JobTitle vs Position

- **JobTitle** — catalog label.
- **HcmPosition** — org slot (code, unit, branch, grade/cadre, cost center, reports-to).
