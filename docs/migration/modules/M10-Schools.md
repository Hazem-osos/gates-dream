# M10 — Schools & Education (Wave 3)

## Scope

Academic years/terms, grades (with cost center), `SchoolStudent` enrollment (guardian = M3 Customer), fee contracts with discounts and bus/books split, term installments, GL accrual / collection (M2) / term revenue recognition.

Legacy `students`, `stages`, `semesters` tables remain for old UI; Wave 3 uses `school_*` and `academic_grades`.

## Prisma (migration `20250816260000_wave3_m10_schools`)

| Model | Role |
|-------|------|
| `SchoolSettings` | GL account codes |
| `SchoolAcademicYear` / `SchoolAcademicTerm` | Calendar |
| `AcademicGrade` | Stage + grade + default tuition + `costCenterId` |
| `SchoolBusRoute` | Bus subscription fee |
| `SchoolStudent` | Enrollment profile |
| `StudentFeeContract` | Fee totals, balances, JE links |
| `StudentFeeInstallment` | Term payment schedule |

## API

| Method | Path |
|--------|------|
| POST | `/api/v1/schools/grades/academic-years` |
| POST | `/api/v1/schools/grades` |
| POST | `/api/v1/schools/students/bus-routes` |
| POST | `/api/v1/schools/students` |
| POST | `/api/v1/schools/contracts` |
| POST | `/api/v1/schools/contracts/:id/post-accrual` |
| POST | `/api/v1/schools/contracts/:id/recognize-revenue` |
| POST | `/api/v1/schools/installments/:id/collect` |

## Services

- `school-structure.service.ts` — years, terms, grades, bus routes
- `student-enrollment.service.ts` — enroll student
- `tuition-billing.service.ts` — contract, accrual JE, M2 collection, term recognition
- `school-account-resolver.service.ts`

## Posting

**Accrual:** Dr student AR (net); Dr tuition discounts; Cr unearned tuition (tuition − discount); Cr bus; Cr books.

**Collection:** Dr safe/bank; Cr student AR (treasury receipt with `offsetAccountId`).

**Term recognition:** Dr unearned tuition; Cr earned tuition (grade cost center).

## Test

```bash
npm run test:wave1-invoices
npm run test:wave3-schools
```
