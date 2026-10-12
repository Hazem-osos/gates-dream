# Payroll Security (Wave B.3)

## Granular permissions

| Permission | Typical routes |
|------------|----------------|
| `payroll:view` | GET `/hr/payroll/*` read surfaces, reports, payslip, dashboard metrics (amounts gated) |
| `payroll:calculate` | POST `/hr/payroll-runs` (create/calculate run) |
| `payroll:approve` | POST `/hr/payroll-runs/:id/approve` |
| `payroll:post` | POST `/hr/payroll-runs/:id/post-accrual` |
| `payroll:pay` | POST `/hr/payroll-runs/:id/disburse` |
| `payroll:rules_manage` | POST/PATCH `/hr/payroll/rules*`, POST `/hr/payroll/rules/validate` |
| `payroll:localization_manage` | POST `/hr/payroll/localization` |
| `payroll:inputs_manage` | POST `/hr/payroll/inputs*`, approve one-time inputs |
| `payroll:gl_manage` | PATCH `/hr/payroll/components/:id/gl` |
| `payroll:edit` | Legacy umbrella; still gates some component/compensation mutations |

## Amount visibility

- `canViewPayrollAmounts` requires `payroll:view` (cached permissions).
- Reports (`/runs/:id/reports/*`), payslip, dashboard totals return **403** without amount permission.
- Payslip without amounts returns structure with `amountsRedacted: true` and null monetary fields.
- Employee list uses `redactEmployeeList` when compensation/payroll view is denied.

## Tenancy

All payroll routes use `companyId` from tenant middleware; cross-company resource IDs return 404.

## HTTP tests

See `hcm-phase5-permissions-http.integration.spec.ts` and Wave B.3 additions for unauthenticated, forbidden, and authorized cases.

## Field redaction utility

`payroll-field-redaction.util.ts`: employee monetary fields, component lines, generic report/run payloads.
