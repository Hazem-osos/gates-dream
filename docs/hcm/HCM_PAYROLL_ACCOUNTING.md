# Payroll Accounting (Phase 5 boundary)

**Unchanged posting path:** `payroll-posting.service.ts` on `PayrollRun` totals.

Phase 5 adds component-level results for reconciliation **read models**; JE line aggregation strategy remains as implemented until component GL mapping is wired to posting.

## Reconciliation targets

| Payroll | GL |
|---------|-----|
| Gross earnings | Salary expense (debit) |
| Employee deductions | Payable accounts (credit) |
| Net | Salary payable |
| Employer contributions | Employer expense + payable |

## Dimensions

Posting must eventually use **snapshot** branch/department/cost center — tracked in `inputSnapshot`; JE dimension wiring is **EVOLVE**.

## Idempotency / reversal

Preserve existing accrual/payment idempotency and advance recovery reversal on unpost.
