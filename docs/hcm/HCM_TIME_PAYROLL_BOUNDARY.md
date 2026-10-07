# Time ↔ Payroll Boundary

Time engine outputs **minutes facts** via `TimePayrollReadService` (scheduled/worked/late/absence/OT).

`PayrollRun` remains canonical for money. `PayrollRunItem.overtime` / `absenceDeduction` are still optional manual inputs — **not** auto-fed in Phase 3.

Future: Payroll Rule Engine consumes approved time summary.
