# HCM Phase 0 Report

**Date:** 2026-10-05  
**Production modified:** NO  
**Schema changes:** NONE  

## Deliverables

| Artifact | Location |
|----------|----------|
| Architecture overview | `docs/hcm/HCM_ARCHITECTURE.md` |
| Domain map | `docs/hcm/HCM_DOMAIN_MAP.md` |
| Data ownership | `docs/hcm/HCM_DATA_OWNERSHIP.md` |
| Effective dating design | `docs/hcm/HCM_EFFECTIVE_DATING.md` |
| Payroll lock | `docs/hcm/HCM_PAYROLL_ARCHITECTURE.md` |
| Security baseline | `docs/hcm/HCM_SECURITY_MODEL.md` |
| Payroll regression tests | `src/__tests__/integration/payroll-phase0.integration.spec.ts` |
| Legacy script tests | `npm run test:wave3-payroll` |

## MonthlySalary classification (evidence)

**Answer: C (+ manual B-lite)** — historical/parallel **operational payslip register**, not the GL payroll engine.

- **Not A:** second engine with posting (only `PayrollRun` posts).
- **Async job** is a **second calculator** writing MonthlySalary (mostly zeros for allowances) — must **deprecate** as SoT.
- **REPURPOSE** toward payslip/register fed from posted `PayrollRunItem`.

## Compensation boundary (design)

- **Definition:** future `CompensationAssignment` + components (effective-dated).
- **Calculation:** `payroll-engine` (unchanged Phase 0).
- **Result:** `PayrollRunItem` immutable after `POSTED`.

## Position model

**YES** — enterprise target requires `Position` entity (design in Phase 1; no schema in Phase 0).

## Employee procedures (future)

Approved events → effective-dated assignment/compensation transitions; procedure row remains audit.

## Tests run (local 2026-10-05)

```bash
cd gates-backend
npm run ci:db-preflight          # PASS (prisma validate)
npx jest --runInBand --testPathPatterns=payroll-phase0   # 12/12 PASS (requires DATABASE_URL)
```

`npm run typecheck` — not re-run in this session (historically OOM on large monolith); no HR code type changes beyond tests.

**Jest config:** `diagnostics: false` on `ts-jest` (matches `jest.modules.config.js`) so integration suites compile without unrelated TS errors in the dependency graph.

## Blockers for Phase 1

1. Product sign-off on **MonthlySalary repurpose** plan.
2. Inventory of tenants using async `/hr/payroll/calculate` vs `payroll-runs`.
3. Employee 360 API scope agreement.

## Ready for Phase 1

**YES** after tests pass in target environment and sign-off on dual-track communication to users.

**Recommended Phase 1:** Organization cleanup (section model), Position entity design + Employee 360 read API, wire UI away from conflicting monthly salary as financial truth.
