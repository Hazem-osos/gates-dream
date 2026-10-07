# HCM Employment Lifecycle

## Target flow

HIRE → ONBOARD → PROBATION → CONFIRM → TRANSFER / PROMOTE / COMPENSATION CHANGE → SUSPEND → RETURN → RESIGN / TERMINATE → OFFBOARD → REHIRE

Phase 2 implements the **event + effective-dated assignment/compensation** spine; notifications and payroll retro are out of scope.

## Hire

`HcmHireService.hireEmployee` creates `Employee`, `HcmEmployment`, initial assignment, and compensation in **one transaction**, then projects to `Employee`.

## Transfer / promotion

Approved events lock `HcmEmployment`, close the interval covering `effectiveDate`, create a new open assignment (and compensation when `basicSalary` is in payload) in the **same transaction**.

## Termination

`RESIGNATION` / `TERMINATION` set employment `TERMINATED`, `terminationDate`, and expose `finalSettlementRequired` in the applied snapshot for future payroll/offboarding.

## Rehire

Reactivates employment and sets `hireDate` to the rehire effective date without deleting prior history.

## Backfill baseline

Rows created by `hcmBackfillService` use change reason / notes marking **migrated baseline**; Employee 360 history treats applied events as authoritative going forward.
