# Leave + Time Payroll Fact Contract (no money)

Per employment / pay period, canonical read model (`TimePayrollReadService` + leave ledger):

- `scheduledMinutes`, `workedMinutes`
- `paidLeaveMinutes`, `unpaidLeaveMinutes`, `sickLeaveMinutes`, `otherApprovedLeaveMinutes`
- `absenceMinutes`, `lateMinutes`, `earlyLeaveMinutes`
- `detectedOvertimeMinutes`, `approvedOvertimeMinutes`
- `leaveEncashmentQuantity` (sum of `ENCASHMENT` ledger units in period — Phase 5 consumer)
- `unresolvedExceptionCount`, locked day indicators via attendance day `status`
- `leaveImpactWarnings` / payroll impact metadata on backdated changes

Payroll Rule Engine (Phase 5) maps facts → money. **PayrollRun calculation unchanged in Phase 4.**
