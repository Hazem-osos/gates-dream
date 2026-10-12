# GATES HCM — PHASE 5.1 WAVE B.6 FINAL CLOSURE (IN PROGRESS)

**Date:** 2026-10-11  
**Production modified:** NO  
**Git commit:** none

## Gate inventory reconciliation (B.5 discrepancy)

B.5 table has **14 rows**: **2 PASS** (accounting reconciliation UI, 1k employee) + **12 non-PASS** user-facing gates.  
The prose “11 open” under-counted by excluding **security acceptance** and **granular permissions** as separate rows while merging others.

**Wave B core acceptance list (12 + 2 already PASS):**

| Gate | B.6 status |
|------|------------|
| Accounting reconciliation UI | PASS (carried) |
| 1,000+ employee read | PASS (carried) |
| Field-level sensitivity | **PASS** (B.6) |
| Field security HTTP matrix | **PASS** (B.6) |
| Granular payroll permissions | **PASS** (B.6) |
| Security acceptance (UI + API) | PARTIAL |
| Rule designer | PARTIAL |
| Localization validation | PARTIAL |
| Report filters/pagination | PARTIAL |
| Rule/config audit | PARTIAL |
| Operations browser E2E | NOT RUN |
| Admin browser E2E | NOT RUN |
| Empty/error/loading | PARTIAL |
| Responsive review | PARTIAL |

**Open core gates:** 9 (not counting carried PASS).

---

## Gate 1 — SECURITY (closed this session)

### Implementation

- `asPayrollApiData()` central wrapper on: dashboard, preview, runs list, review, simulate, payslip, compensation list, posting/disburse/approve responses, employee 360, canonical payslips (403 without amounts).
- Employee list/detail redaction unchanged; payroll-run GET/create/async job serialization retained.

### Tests executed

| Test | Result |
|------|--------|
| `jest …/hcm-phase5-wave-b5-field-security.integration.spec.ts` | **10/10 PASS** |
| `jest …/hcm-phase5-permissions-http.integration.spec.ts` | **16/16 PASS** |
| `jest …/payroll-response.serializer.spec.ts` | **2/2 PASS** |

**Evidence:** `gates-backend/src/__tests__/integration/hcm-phase5-wave-b5-field-security.integration.spec.ts`

### E2E auth groundwork (not yet PASS)

- `gates-backend/scripts/seed-e2e-hcm-payroll.ts` + `E2E_AUTO_SEED=1` in `global-hcm-setup.ts`
- Credentials written to `gates-web/e2e/.auth/e2e-credentials.json` (must be gitignored)

---

## Remaining work (subsequent gates)

Ops/Admin Playwright PASS, rule designer HTTP lifecycle, localization overlap UI, report HTTP filter matrix, audit mutation tests, full regression suites, TS debt triage, UX/responsive verification.

**Wave B:** INCOMPLETE  
**Phase 5:** INCOMPLETE
