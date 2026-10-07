# HCM Payroll UI Audit (Wave B)

| Screen | Path | Classification | Notes |
|--------|------|----------------|-------|
| Payroll hub redirect | `/hr/payroll` | KEEP | Redirects to dashboard |
| Dashboard | `/hr/payroll/dashboard` | EVOLVE | Backend metrics + preview; Wave B layout nav |
| Runs list | `/hr/payroll/runs` | EVOLVE | Paginated list, preview, async calc |
| Run review | `/hr/payroll/runs/[id]` | KEEP (new) | Workflow actions, reconciliation, explainability |
| Payslip | `/hr/payroll/runs/[id]/payslip/[employeeId]` | KEEP (new) | Canonical PayrollRunItem components |
| Pay components | `/hr/payroll/components` | EVOLVE | List; create/edit in Wave B+ |
| Rules | `/hr/payroll/rules` | EVOLVE | Simulator + variable catalog |
| Localization | `/hr/payroll/localization` | EVOLVE | Structured admin pending fuller forms |
| GL mapping | `/hr/payroll/gl-mapping` | KEEP (new) | Readiness status |
| One-time inputs | `/hr/payroll/inputs` | KEEP (new) | List; bulk import deferred |
| Reports | `/hr/payroll/reports` | KEEP (new) | Server reports by run id |
| Employee 360 payroll tab | `/hr/employee-360` | EVOLVE | Canonical history; amounts gated |
| Monthly salaries | `/hr/monthly-salaries` | LEGACY_READ_ONLY | Nav labeled Legacy |
| Monthly disbursement | `/hr/monthly-salaries-disbursement` | LEGACY_READ_ONLY | Not canonical PayrollRun pay |
| Legacy payroll-report | `/hr/payroll-report` | MIGRATE | Should consume PayrollRun reports |

**Duplicate navigation removed from dashboard:** primary ops point to HCM workspace; legacy monthly salaries linked explicitly.
