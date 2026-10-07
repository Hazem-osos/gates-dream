# Payroll Security

## Permissions (existing + target)

| Action | Resource | Status |
|--------|----------|--------|
| view | payroll | Implemented |
| edit | payroll | Implemented (calculate/create/post via payroll-runs) |
| approve | payroll | Reuse workflow foundation (TBD strict SoD) |

Phase 5 routes:

- Components/rules create → `payroll:edit`
- Preview/simulate/payslip → `payroll:view`

Granular `payroll:rules_manage`, `payroll:localization_manage`, etc. — **EVOLVE** in permission catalog.

## Field sensitivity

- Payslip and run APIs must not expose bank/tax ID via generic employee serializers.
- Employee 360 payroll tab should read `PayrollRunItem` + components only for authorized roles.

## Tenancy

All queries scoped by `companyId` from tenant middleware; cross-company FK rejected.
