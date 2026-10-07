# Payroll — Deep Audit

## Entry points

| Path | Role |
|------|------|
| `payroll-engine.service.ts` | Creates `PayrollRun` + items; core math |
| `payroll-posting.service.ts` | Accrual + payment journals, advance recovery |
| `payroll-run.routes.ts` | CRUD, post-accrual, post-payment, reverse |
| `payroll.routes.ts` | Legacy calculate job + monthly flows |
| `monthly-salary.service.ts` | `MonthlySalary` documents |
| `hr-gl-account-resolver.service.ts` | Account resolution from `HrSettings` |
| `workers/processors/payroll.processor.ts` | Async recalculation |

## Calculation trace (PayrollRun)

```
Active employees (companyId, isActive)
  → basicSalary + fixedAllowances (Employee)
  → + SUM(all active Allowance.defaultAmount)  // company-wide, every employee
  → + SUM(all active Deduction.defaultAmount) // subtracted
  → advance recovery: FIFO open EmployeeAdvance installments
  → HrSettings: socialInsuranceEmployeeRate, socialInsuranceEmployerRate, taxRate (flat %)
  → persist PayrollRunItem (gross, deductions, net, employer cost, …)
```

**WagePolicy:** linked on contract in UI/schema — **`payroll-engine.service.ts` does not apply `WagePolicy.rules` JSON.**

## Components supported

| Component | Supported | Notes |
|-----------|-----------|-------|
| Basic salary | ✅ | Employee field |
| Fixed allowances (lump) | ✅ | Employee field |
| Named allowances (master) | ⚠️ | All company defaults to everyone |
| Named deductions (master) | ⚠️ | All company defaults to everyone |
| Percentage / formula components | ❌ | Only flat rates in HrSettings |
| Conditional rules | ❌ | |
| Effective dates | ❌ | |
| Retro / off-cycle / arrears | ❌ | |
| Overtime / lateness / absence | ❌ | Not in engine |
| Bonus / commission | ❌ | Unless manual procedure amount (not in run) |
| Tax | ✅ | Single flat `taxRate` on taxable base |
| Social insurance | ✅ | Employee + employer % |
| Loans / advances | ✅ | Advance installments in engine |
| Manual override per line | **PARTIAL** | Update run item routes may exist — verify before production reliance |
| Final settlement | **PARTIAL** | Separate clearance/disbursement services |

## Rule engine?

**NO** — hardcoded TypeScript in `payroll-engine.service.ts` + static rates in `HrSettings`.

**Classification:** **PARTIAL** (configurable rates and GL codes, not component rules).

## Immutability

- `PayrollRun.status` transitions (DRAFT → posted states) — posting sets journal IDs.
- **Risk:** Recalculation endpoints may rewrite items if status allows — audit `payroll-run.service.ts` for lock rules.
- **Assumption:** Posted runs should reject recalc — **verify in code before trusting** (treat as **PARTIAL** until proven).

## Parallel: MonthlySalary

- Operational monthly salary documents with disbursement integration.
- **DUPLICATED** conceptual track with `PayrollRun` — risk of two sources of truth.

## Egypt-specific signals

- Default SI rates 11% / 18.75% in settings seed/defaults.
- Arabic comments in services; currency not multi-country.

## Formula locations (grep targets)

- `payroll-engine.service.ts` — main gross/net.
- `reports.service.ts` — wage policy JSON for **reports**, not pay calc.
- `employee-contract.service.ts` — contract validation, not monthly run.
- Clearance services — EOS / housing / leave **valuation** formulas separate from monthly run.

**Payroll maturity:** **4/10** (working run + GL path for tenants using it; not enterprise rule engine).
