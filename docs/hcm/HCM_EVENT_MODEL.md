# HCM Employment Event Model

## Decision

Phase 2 introduces **`HcmEmploymentEvent`** as the authoritative lifecycle record instead of overloading `EmployeeProcedure`. Procedures remain legacy/operational logs; events drive effective-dated employment state.

## Core fields

- Identity: `companyId`, `employmentId`, `eventType`, `effectiveDate`
- Workflow: `status` (`DRAFT` → `SUBMITTED` → `APPROVED` → `APPLIED`; `REJECTED` / `CANCELLED`)
- Payload: typed JSON per event (department, position, salary, etc.)
- Audit: `requestedBy/At`, `approvedBy/At`, `rejectedBy/At`, `rejectionReason`
- Application: `beforeSnapshot`, `afterSnapshot`, `appliedAt`, `assignmentId`, `compensationId`

## Semantics

**Approval time ≠ effective time.** An event approved on 5 Oct with effective date 1 Nov updates assignment/compensation intervals from 1 Nov; `Employee` compatibility projection syncs only when `effectiveDate <= today` (on-read reconciliation for future dates).

## Event types (single engine)

Handlers share `HcmEmploymentEventService.applyEvent` with `ASSIGNMENT_EVENTS` and `COMPENSATION_EVENTS` sets plus employment status transitions (suspend, terminate, rehire).

## API

`POST /api/v1/hr/employment-events`, submit, approve, reject; `GET .../employment/:employmentId`.
