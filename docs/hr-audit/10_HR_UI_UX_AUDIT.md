# HR UI / UX Audit

**Root:** `gates-web/app/hr/` — **76** route pages.  
**Nav:** `hr-sidebar.config.ts`.

## Navigation tree (condensed)

```
HR (/hr)
├── Dashboard (page.tsx)
├── Masters
│   ├── nationalities, religions, marital-status, cities
│   ├── managements, departments, job-titles, job-cadres
│   ├── qualifications, scientific-specializations, document-types, tickets
│   ├── allowances, deductions, wage-policy, payroll-policies
│   └── settings
├── Employee
│   ├── employees, employee-data, employee-contract, employee-files
│   └── employee-advance, employee-procedures, transaction-tracking
├── Operations (lifecycle / discipline / training)
│   ├── transfer, promotion, suspend, checkout, onboarding, secondment
│   ├── warning, penalty, reward, training-course, working-days, reminder
│   └── admin-procedures, procedures, transactions, transaction-models
├── Attendance & time
│   ├── attendance-sheet-fingerprint, attendance-preview, work-shifts
│   ├── delay-permission, absence-permission, employee-absence-overtime
│   └── company-leave-days-definition, annual-leave-registration
├── Payroll & entitlements
│   ├── payroll → redirect monthly-salaries
│   ├── monthly-salaries, monthly-salaries-disbursement
│   ├── clearances (EOS, housing, annual leave)
│   └── disbursements (EOS, housing, annual leave)
└── Reports (hub + many *-report pages)
```

## API wiring (evidence)

Pages using `useApiQuery` / `useApiMutation` (representative):  
`employee-data`, `employee-contract`, `employee-advance`, `employee-procedures`, `transaction-tracking`, `monthly-salaries`, `departments`, `managements`, lookups via `HrMasterLookupPage`, `settings`, `wage-policy`, disbursement/clearance pages, `page.tsx` dashboard.

**Many operation/report pages:** use `HrPageChrome` + forms with `apiClient.post` in components (e.g. `HrEmployeeDepartmentMoveFormPage`) — **FUNCTIONAL** but not React Query cached.

**Shell / weak backend:** fingerprint, shifts, some attendance previews — **INCOMPLETE**.

## Page classification (sample)

| Page | Class |
|------|-------|
| employee-data | **GOOD** — E2E |
| employee-contract | **GOOD** |
| monthly-salaries | **FUNCTIONAL** — parallel payroll track |
| payroll-policies | **INCOMPLETE** — unclear PayrollRun UI |
| employee-onboarding | **INCOMPLETE** — no workflow |
| attendance-sheet-fingerprint | **INCOMPLETE / UI shell** |
| reports hub | **FUNCTIONAL** — mixed |
| duplicate report vs operation | **SHOULD BE MERGED** (e.g. transfer + transfer-report) |

## UX gaps

- **No Employee 360** — data split across employee-data, contract, procedures, reports.
- **No ESS portal** — same admin UI patterns.
- Heavy navigation for related tasks (transfer form vs report vs procedure list).
- Inconsistent: some masters use shared `HrMasterLookupPage`, others custom.

## Components

- `HrPageChrome`, `HrMasterLookupPage`, `HrEmployeeDepartmentMoveFormPage`, `hr-sidebar.config.ts`
- Validation: `gates-web/lib/validation/hr.schema.ts`

**Self-service maturity:** **1/10** (no dedicated ESS).
