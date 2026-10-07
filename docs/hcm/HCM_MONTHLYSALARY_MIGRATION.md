# MonthlySalary migration status (Wave B.2 full-repo audit)

| Consumer | Classification |
|----------|----------------|
| `gates-web/app/hr/monthly-salaries` | LEGACY_READ_ONLY |
| `gates-web/app/hr/monthly-salaries-disbursement` | LEGACY_READ_ONLY |
| `gates-web/app/hr/payroll-report` | MIGRATE (legacy report UI) |
| `gates-web/app/hr/payroll/**` (HCM workspace) | MIGRATED_TO_PAYROLLRUN — **0 MonthlySalary imports** |
| `gates-web/app/hr/payroll/dashboard` | MIGRATED_TO_PAYROLLRUN (label only) |
| `gates-web/app/hr/employee-360` payroll tab | MIGRATED_TO_PAYROLLRUN |
| `gates-backend/workers/processors/payroll.processor.ts` | DEPRECATED (throws; legacy MonthlySalary path) |
| `gates-backend/src/modules/hr/routes/payroll.routes.ts` | DEPRECATED async job |
| `gates-backend/src/modules/hr/routes/monthly-salary.routes.ts` | LEGACY_READ_ONLY |
| `gates-backend/src/modules/hr/services/monthly-salary.service.ts` | LEGACY_DATA_MODEL |
| `gates-backend/src/modules/hr/services/monthly-salaries-disbursement.service.ts` | LEGACY_READ_ONLY |
| `gates-backend/src/modules/ai/tools/hr-payroll.tool.ts` | REMOVE_LATER (aggregate MonthlySalary) |
| `gates-backend/src/modules/hr/services/reports.service.ts` | HISTORICAL_READ_ONLY sections |
| `gates-backend/src/__tests__/integration/payroll-phase0.integration.spec.ts` | TEST_ONLY |
| `gates-backend/prisma/schema.prisma` (`MonthlySalary` model) | LEGACY_DATA_MODEL |

**Invariant:** NEW HCM payroll canonical UI (`gates-web/app/hr/payroll/**`) has **0** MonthlySalary consumers.

**Navigation:** HCM payroll workspace is primary; Monthly Salaries linked as Legacy from payroll layout.
