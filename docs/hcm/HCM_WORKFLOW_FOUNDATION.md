# HCM Workflow Foundation

## Status machine

| Status | Meaning |
|--------|---------|
| DRAFT | Editable, not validated |
| SUBMITTED | Awaiting approval; blocks other SUBMITTED events per employment |
| APPROVED | Approved; apply may run immediately in Phase 2 API |
| APPLIED | Authoritative state written |
| REJECTED | Closed with reason |

Phase 2 uses **service-level** approval (`approve` → `applyEvent`) rather than a separate BPM product. Gates `/api/v1/approval` can be wired later per event type.

## Permissions

- `employment:view` / `employment:manage`
- `compensation:view` / `compensation:manage` (360 compensation tab)

## Extension

Event type → required approver chain (Employee → Manager → HR → Finance) can be added as configuration without duplicating per-controller logic.
