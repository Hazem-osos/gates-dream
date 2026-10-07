# Payroll Input Snapshot

On each `createPayrollRun` (DRAFT recalc), `HcmPayrollRunSnapshot` stores:

- `ruleSetFingerprint` — hash of active rule definitions at calculation time
- `inputSnapshot` JSON:
  - `period`
  - `calculationMode` (`LEGACY` | `RULE_ENGINE`)
  - `employees[employeeId]` — employment, compensation, time, leave, advances, inputs, statutory

**Immutability:** Posted runs must not be recalculated; snapshot is evidence for payslip explainability.

**Component results:** `HcmPayrollItemComponent` per `PayrollRunItem` — amounts, rule code, explanation JSON.

Historical payslips read stored components, not live salary/time.
