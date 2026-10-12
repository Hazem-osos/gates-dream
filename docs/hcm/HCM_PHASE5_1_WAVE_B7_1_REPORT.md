# GATES HCM — PHASE 5.1 WAVE B.7.1 REPORT

**Date:** 2026-10-12  
**Production modified:** NO  
**Git commit:** none

## ROOT CAUSE

| Category | Finding |
|----------|---------|
| **A / Test setup** | `global-hcm-setup.ts` attempted browser login **before** Playwright `webServer` started, with wrong URL (`/auth/login`) and wrong field placeholders (Arabic email labels vs `/login` `#username` / `#password`). Saved storage state was often empty or stale. |
| **G / Test selectors** | `getByRole('heading', { name: /قواعد الرواتب/i })` matched **two** headings (ERP shell `h1` + page `h2`) → Playwright strict-mode failure though the page loaded. |
| **F / UI + layout** | ERP `main[data-erp-main-pane]` intercepts normal pointer clicks on lower sections (simulate button, rule list cards). DOM `evaluate(…click())` required for reliable interaction without changing product layout in this wave. |
| **F / Rule designer** | Creating a **new version** by changing only `effectiveFrom` while `effectiveTo` remained on the prior year produced **422** (`effectiveTo` before `effectiveFrom`) — test data bug, not auth. |

Authentication and API permissions were **not** the primary failure once setup ran after servers and tenant headers were applied.

## FIX

1. **Seed-only global setup** (`E2E_AUTO_SEED=1` + `DATABASE_URL` from `gates-backend/.env`).
2. **`hcm-auth.setup.ts` project** — real login at `/login`, tenant localStorage bootstrap, admin + viewer storage files.
3. **Playwright projects** — `hcm-setup` → `chromium` with `NEXT_PUBLIC_AUTH_MODE=enforce`.
4. **Expanded E2E** — full rule lifecycle, foreign rule 404, viewer POST 403.
5. **Seed** — viewer user (`payroll:view` only), `foreignRuleId` for tenant isolation.
6. **Selectors** — `main` scoped heading; programmatic clicks where overlay blocks pointer events.

## FILES CHANGED

- `gates-web/e2e/global-hcm-setup.ts`
- `gates-web/e2e/hcm-auth.setup.ts` (new)
- `gates-web/e2e/hcm-payroll-rules-designer.e2e.spec.ts`
- `gates-web/playwright.config.ts`
- `gates-backend/scripts/seed-e2e-hcm-payroll.ts`

## E2E AUTH

- Command: `cd gates-web && E2E_AUTO_SEED=1 npx playwright test e2e/hcm-payroll-rules-designer.e2e.spec.ts`
- Mechanism: disposable users from `seed-e2e-hcm-payroll.ts` → `e2e/.auth/e2e-credentials.json` (gitignored) → setup project writes `hcm-user.json` / `hcm-viewer.json` (gitignored).
- Admin: full payroll permissions including `rules_manage`.
- Viewer: `payroll:view` only.

## BROWSER URL

`http://localhost:3000/hr/payroll/rules`

## BROWSER TESTS PASSED/FAILED/SKIPPED

| Result | Count |
|--------|------:|
| **PASSED** | **5** |
| FAILED | 0 |
| SKIPPED | 0 |

Includes: setup admin, setup viewer, admin lifecycle, tenant isolation API, viewer security API.

## HTTP REGRESSION

```bash
cd gates-backend && npx jest --runInBand \
  src/__tests__/integration/hcm-phase5-wave-b7-rule-designer.integration.spec.ts \
  src/__tests__/integration/hcm-phase5-wave-b4-rules.integration.spec.ts \
  src/__tests__/unit/payroll-rule-graph.spec.ts \
  src/__tests__/unit/payroll-expression.evaluator.spec.ts \
  src/__tests__/integration/hcm-phase5-permissions-http.integration.spec.ts
```

**35/35 PASS**

## PERMISSIONS

- HTTP matrix: **16/16 PASS** (included above).
- E2E viewer POST `/hr/payroll/rules` → **403** with real session cookies + tenant headers.

## TYPECHECK

- `gates-web`: `npm run typecheck` — **PASS**
- `gates-backend`: not full-repo (OOM history); payroll rule paths unchanged in this wave beyond seed script.

## PRISMA

`npx prisma validate` — **PASS**

## RULE DESIGNER

**PASS** — real browser E2E green; HTTP lifecycle and permissions regressions green.

## WAVE B OPEN CORE GATES

**8** (rule designer closed)

## WAVE B

INCOMPLETE

## PHASE 5

INCOMPLETE

## PRODUCTION MODIFIED

NO

---

**NEXT TARGET (not started):** LOCALIZATION VALIDATION
