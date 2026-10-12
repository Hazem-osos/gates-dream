# GATES HCM — PHASE 5.1 WAVE B.7 FINAL REPORT

**Date:** 2026-10-11  
**Production modified:** NO  
**Git commit:** none (worktree preserved)

## Root causes of prior RULE DESIGNER = PARTIAL

| Issue | Impact |
|-------|--------|
| Rule HTTP handlers used bare `async` without `asyncHandler` | `AppError` (422/403/404) left requests hanging; integration tests timed out at 120s |
| `getRuleById` referenced `rule.id` instead of `row.id` | Detail read could throw after load; foreign-tenant tests flaky |
| Condition validation used `evaluatePayrollExpression` | Comparison conditions (`period_days > 0`) rejected at create/save though engine supports them via `evaluatePayrollCondition` |
| PATCH omitted rounding/min/max/localization (prior wave) | Field round-trip incomplete (addressed in B.7 UI + routes) |
| No overlap guard on create (prior wave) | Overlapping versions could be inserted |
| `validateAndCheckGraph` duplicated draft code in graph | Re-validate of existing code ignored draft `dependsOn` when another row shared the same code (fixed by excluding `draft.code` from persisted rows) |
| Playwright rule designer E2E | Authenticated run did not reach designer heading (env/session); not re-verified PASS in this session |

## Files changed (B.7 completion)

**Backend**

- `gates-backend/src/modules/hr/services/payroll/payroll-rule-admin.service.ts` — overlap/effective range, frozen guard, `getRuleById`, extended `updateRule`/`createRule`, condition validation via `evaluatePayrollCondition`, graph validate excludes replaced code
- `gates-backend/src/modules/hr/routes/hcm-payroll.routes.ts` — `GET /rules/detail/:id`, `POST /rules`, extended `PATCH`, `asyncHandler` on rule lifecycle routes
- `gates-backend/src/__tests__/integration/hcm-phase5-wave-b7-rule-designer.integration.spec.ts` — HTTP lifecycle matrix

**Frontend**

- `gates-web/app/hr/payroll/rules/page.tsx` — detail load, frozen read-only, new-version POST, save errors, simulate display
- `gates-web/e2e/hcm-payroll-rules-designer.e2e.spec.ts` — auth guard + heading matcher aligned with admin E2E

## Behavior completed

- **CRUD + detail:** Create/read/update with full supported field round-trip via `GET /rules/detail/:id`
- **Validate / simulate:** Canonical expression + condition evaluators; simulate does not create payroll runs
- **Versions:** `GET /rules/:code/versions`; new effective date → POST new version from UI
- **Effective dating:** Overlap rejected (422); invalid ranges rejected
- **Frozen rules:** Formula/condition PATCH blocked when `hcmPayrollItemComponent.ruleId` references rule
- **Dependencies:** Missing rule reported on validate; cycles covered by `payroll-rule-graph.spec.ts` (component-level graph with seeded catalog shares component codes — cycle detection via validate is limited when multiple rules share one pay component)
- **Permissions / tenancy:** `rules_manage` for mutate; view for list/detail/simulate; foreign company detail → 404

## HTTP tests executed

```bash
cd gates-backend
npx jest --runInBand --forceExit \
  src/__tests__/integration/hcm-phase5-wave-b7-rule-designer.integration.spec.ts \
  src/__tests__/integration/hcm-phase5-wave-b4-rules.integration.spec.ts \
  src/__tests__/unit/payroll-rule-graph.spec.ts \
  src/__tests__/unit/payroll-expression.evaluator.spec.ts
```

| Suite | Result |
|-------|--------|
| `hcm-phase5-wave-b7-rule-designer.integration.spec.ts` | **6/6 PASS** |
| `hcm-phase5-wave-b4-rules.integration.spec.ts` | **3/3 PASS** |
| `payroll-rule-graph.spec.ts` | **3/3 PASS** |
| `payroll-expression.evaluator.spec.ts` | (included in bundle) **PASS** |

`hcm-phase5-permissions-http.integration.spec.ts` (includes `POST /rules` 403 without `rules_manage`): **16/16 PASS** (re-run with B.7 in session).

```bash
npx prisma validate
```

**Prisma validate:** PASS

## UI verification

```bash
cd gates-web
npx playwright test e2e/hcm-payroll-rules-designer.e2e.spec.ts --reporter=line
```

**Result:** FAIL — heading `قواعد الرواتب` not visible within 30s (screenshot: `test-results/hcm-payroll-rules-designer-*/test-failed-1.png`). Auth file present; likely stale session, backend not reachable from Playwright webServer, or missing payroll module access in stored cookies. **Not sufficient for acceptance criterion 8.**

Manual UI checklist (code review): structured form, validate/simulate/save flows, version panel, frozen banner, no primary raw JSON — implemented in `rules/page.tsx`.

## Regression

- Wave B.4 rule immutability + invalid formula: PASS  
- Wave B.7 HTTP lifecycle: PASS  
- Rule graph + expression unit tests: PASS  
- Permissions HTTP matrix: PASS  

Full-repo backend `tsc` not re-run (known OOM); HR-only debt unchanged.

## Remaining blockers

1. **Playwright rule designer E2E** — needs green run against live `localhost:3000` + API with seeded `rules_manage` user (`E2E_AUTO_SEED=1`, fresh `hcm-user.json`).
2. **Graph validate vs. catalog** — multiple rules per pay component: `orderPayrollRules` last-wins per `componentCode`; document or merge deps if product requires strict multi-rule cycle checks on validate.
3. **`updateRule`** does not re-run dependency graph (create/validate do) — dependency changes on PATCH rely on validate step in UI.

---

## Final status

| Item | Status |
|------|--------|
| **RULE DESIGNER** | **PARTIAL** (API lifecycle PASS; browser E2E not verified PASS) |
| **WAVE B OPEN CORE GATES** | **9** |
| **WAVE B** | INCOMPLETE |
| **PHASE 5** | INCOMPLETE |
| **PRODUCTION MODIFIED** | NO |

**NEXT TARGET AFTER VERIFIED PASS:** LOCALIZATION VALIDATION (do not start in this session).
