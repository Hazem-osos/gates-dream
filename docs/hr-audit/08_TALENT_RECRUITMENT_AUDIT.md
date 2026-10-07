# Talent: Recruitment, Performance, Learning

## Recruitment / ATS

| Artifact | Status |
|----------|--------|
| Prisma models | **NONE** |
| Backend routes | **NONE** in `modules/hr` |
| Frontend | **NONE** dedicated |
| Candidate → employee | **NOT SUPPORTED** |

**Maturity:** **E — MISSING**

## Performance

| Artifact | Status |
|----------|--------|
| Goals / KPI / OKR | **NONE** |
| Appraisal cycles | **NONE** |
| 360 / competencies | **NONE** |
| Link to bonus/promotion | Procedures can log `reward` / `promotion` — **manual**, no performance system |

**Maturity:** **E — MISSING** (procedure log only)

## Learning / skills

| Artifact | Status |
|----------|--------|
| Course / certification models | **NONE** |
| Employee skills | **NONE** |
| `employee-training-course` page | Posts **employee procedures** — **PARTIAL** UX only |
| Reports | `employee-courses-report` — likely report service over procedures |

**Maturity:** **D — BASIC** (logging)

## Benefits (non-payroll)

- No `BenefitEnrollment` model.
- Allowances masters are payroll defaults, not benefit plans.
- Insurance flags on contract — **boolean fields**, not benefit provider integration.

## Loans

- **`EmployeeAdvance`** — salary advance with installments; payroll deduction — **WORKING**.
- Long-term employee loan product (reschedule, skip, separate GL loan account per employee) — **PARTIAL** (advance-focused).

## Disciplinary

- `EmployeeProcedure` types: `warning`, `penalty`, etc. — **WORKING** as log.
- No case management, hearings, or legal hold.

## Expenses / travel

- Not in HR module — check accounting/expense modules separately — **OUT OF HR SCOPE** in this audit: **NOT FOUND** in `modules/hr`.

**Talent maturity overall:** **1/10**
