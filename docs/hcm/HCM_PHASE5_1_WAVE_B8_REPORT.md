# GATES HCM — PHASE 5.1 WAVE B.8 REPORT

**Date:** 2026-10-12  
**Production modified:** NO  
**Git commit:** none

## ROOT CAUSES

| Area | Finding |
|------|---------|
| **Schema / UI mismatch** | Localization UI posted `configKey: DEFAULT` and `{ insuranceCap, taxBrackets: [] }`, while EG/SA providers expect `INSURANCE_CAP` (`maxBase`), `TAX_BRACKETS` (`brackets`), `GOSI_RATES` (rates). Statutory facts ignored DEFAULT-shaped rows. |
| **Overlap guard** | `assertNoOverlap` filtered only `companyId` + `countryCode`, so different `configKey` values could false-block; fixed to include `configKey`. |
| **HTTP surface** | No `POST /localization/validate`, no `GET /localization/detail/:id`, no version list route; create audit action labeled `UPDATED`; routes lacked `asyncHandler`. |
| **Frontend UX** | No validate-before-save, detail load, version panel, field-level errors, or SA rate fields. |
| **Tests** | B.5 had a single service-level negative cap test only; no HTTP lifecycle, immutability, or Playwright coverage. |
| **E2E seed** | `foreignLocalizationId` collided with catalog `INSURANCE_CAP` seeded on `otherFx` — resolved by reusing existing foreign row or alternate key/date. |
| **E2E clicks** | Collapsed nav sidebar + designer `z-30`/`bg-background` so **تحقق** receives pointer events without programmatic click. |

## FILES CHANGED

**Backend**

- `gates-backend/src/modules/hr/services/payroll/payroll-localization-admin.service.ts` — validation, normalize, provider check, overlap per key, `getConfigById`, `listVersions`
- `gates-backend/src/modules/hr/routes/hcm-payroll.routes.ts` — validate/detail/versions routes, `asyncHandler`, audit `CREATED`
- `gates-backend/src/__tests__/integration/hcm-phase5-wave-b8-localization.integration.spec.ts` (new)
- `gates-backend/src/__tests__/integration/hcm-phase5-wave-b5-localization.integration.spec.ts` — `INSURANCE_CAP` / `maxBase`
- `gates-backend/src/__tests__/integration/hcm-phase5-permissions-http.integration.spec.ts` — POST body aligned to canonical keys
- `gates-backend/scripts/seed-e2e-hcm-payroll.ts` — `foreignLocalizationId`

**Frontend**

- `gates-web/app/hr/payroll/localization/page.tsx` — TEST designer, validate/save, versions, audit, detail load
- `gates-web/e2e/hcm-payroll-localization.e2e.spec.ts` (new)

## BACKEND VALIDATION

- Negative / invalid `maxBase`, bracket rate bounds, non-increasing `upTo`, empty brackets, SA rate 0–1, `effectiveTo` before `effectiveFrom`, invalid `configKey`, overlapping effective periods (per key), provider `validateConfiguration`
- Structured 422 messages via `AppError`; validate endpoint returns `{ valid, errors }`

## FRONTEND VALIDATION

- تحقق → `POST /localization/validate`; errors on controls + list
- حفظ إصدار only after user flow; backend errors surfaced in UI
- EG: `INSURANCE_CAP`, `TAX_BRACKETS`; SA: `GOSI_RATES`; all labeled TEST

## EFFECTIVE DATING

- Create version with `effectiveFrom` / optional `effectiveTo`
- Overlap prohibited per `(companyId, countryCode, configKey)`
- Version list: `GET /localization/:countryCode/:configKey/versions`

## HISTORICAL IMMUTABILITY

- HTTP test: payroll run month 1 calculated with cap 8000; future `INSURANCE_CAP` from 2027-01-01 does not alter stored `hcmPayrollItemComponent` amounts on the existing run

## AUDIT

- Create records `HCM_PAYROLL_LOCALIZATION` / `CREATED` via `payrollConfigAuditService`
- HTTP test asserts audit row for new config id

## PERMISSIONS

- `localization_manage` required for POST validate/create (permissions matrix + B.8 HTTP + viewer E2E 403)

## TENANT ISOLATION

- `GET /localization/detail/:id` scoped to `companyId`; foreign id → 404 (HTTP + E2E)

## HTTP TESTS

```bash
cd gates-backend && export $(grep -v '^#' .env | xargs) && npx jest --testPathPatterns="hcm-phase5-wave-b8-localization|hcm-phase5-wave-b5-localization|hcm-phase5-wave-b7-rule-designer|hcm-phase5-wave-b4-rules|hcm-phase5-permissions-http"
```

**31/31 PASS** (5 B.8, 1 B.5, 6 B.7, … permissions + B.4)

## BROWSER E2E PASSED/FAILED/SKIPPED

```bash
cd gates-web && E2E_AUTO_SEED=1 npx playwright test e2e/hcm-payroll-localization.e2e.spec.ts
```

| Result | Count |
|--------|------:|
| **PASSED** | **5** |
| FAILED | 0 |
| SKIPPED | 0 |

(Includes hcm-setup admin + viewer, admin lifecycle, tenant isolation, viewer 403.)

## REGRESSION

- Localization + rule designer + permissions HTTP: **31/31 PASS** (see above)
- Rule Designer Playwright (B.7.1): not re-run in this wave; no rule route regressions intended

## BACKEND TYPECHECK

- `npx tsc --noEmit` — process completed exit 0 in this environment; full-repo check remains heavy (pre-existing OOM risk on large `gates-backend` compile). Payroll localization paths are typed via integration tests.

## FRONTEND TYPECHECK

- `cd gates-web && npm run typecheck` — **PASS**

## PRISMA

- `npx prisma validate` — **PASS**

## DIFF CHECK

- `git diff --stat` — uncommitted worktree preserved; no reset/clean/commit in this wave

## LOCALIZATION VALIDATION

**PASS**

## WAVE B OPEN CORE GATES

**7** (localization gate closed)

## WAVE B

**INCOMPLETE**

## PHASE 5

**INCOMPLETE**

## NEXT TARGET ONLY AFTER VERIFIED PASS

**REPORT FILTERS / PAGINATION**
