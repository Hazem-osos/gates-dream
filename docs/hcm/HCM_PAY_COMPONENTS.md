# Pay Component Catalog

Model: `HcmPayComponent` (per company, unique `code`).

## Types

- `EARNING`
- `DEDUCTION`
- `EMPLOYER_CONTRIBUTION`

## Metadata

- Names (AR/EN), taxable/insurable class, recurring flag, payslip visibility
- GL expense/payable account IDs (optional)
- `priority` for ordering

## Standard codes (seeded per tenant as needed)

`BASIC`, `HOUSING`, `TRANSPORT`, `OVERTIME`, `BONUS`, `ABSENCE`, `UNPAID_LEAVE`, `TAX`, `SOCIAL_INSURANCE_EE`, `SOCIAL_INSURANCE_ER`, `ADVANCE_RECOVERY`, etc.

Behavior comes from **rules**, not enum switches in services.

## Employee package

`HcmCompensationComponentAssignment` — effective-dated amount per employment + component.

Legacy `Employee.basicSalary` seeds BASIC only when no assignment exists (compatibility).
