# HCM Backdated Changes

## Assignment / compensation

Transitions use the **timeline engine** (`hcm-timeline.domain.ts`): splits the containing interval at `effectiveDate`, caps the new segment before the next known transition, and preserves later history. Overlap assertions reject ambiguous intervals.

## Payroll

`HcmPayrollImpactService` (read-only) detects intersection with **POSTED** or **PAID** `PayrollRun` periods for the employee. Backdated compensation changes return warning metadata; **no** `PayrollRunItem` mutation.

## Compatibility projection

`HcmCompatibilityService.syncEmployeeProjection(companyId, employmentId, asOf)` only updates legacy `Employee` fields when the resolved assignment/compensation at `asOf` is current—future-dated events do not switch compatibility early.

## Employee edits

Direct updates to `departmentId` or `basicSalary` are **blocked** when `HcmEmployment` exists; use lifecycle events.
