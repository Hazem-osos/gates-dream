# Leave × Payroll Boundary

`TimePayrollReadService` aggregates leave minutes from attendance days. PayrollRun calculation is unchanged.

Manual absence on PayrollRun remains supported. Migration path: Time/Leave facts → future Payroll Rule Engine.

`HcmPayrollImpactService` surfaces posted/paid period intersection for backdated leave changes.
