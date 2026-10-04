# P2-1 Legacy EVM boundary

## Canonical actual cost (P2-1 forward)

**`ProjectCostAllocation`** plus **`ProjectCostQueryService`** APIs under
`/contracting/cost-control/projects/:projectId/actual-cost/*` are the **only**
canonical analytical source for **actual project / BOQ cost** in P2-2 profitability
and control screens.

Sources synced into allocations:

- Posted inventory issues (project + optional BOQ tags) → `MATERIAL`
- Finance-posted subcontract invoice line gross work → `SUBCONTRACTOR`
- Posted treasury expense debits mapped to a project cost center → `DIRECT_EXPENSE`
- Manual BOQ splits (bounded) → `OTHER` / category per split

## Legacy EVM (`ProjectCostControlService`)

The existing **EVM / budget-vs-actual** service remains for earned-value style
metrics. It may aggregate journal lines, material reconciliation logs, and
**weighted** BOQ allocation heuristics.

**Do not add** legacy EVM totals into P2 actual-cost summary APIs. P2-2 must
read **`ProjectCostQueryService`**, not independently sum EVM + allocations
(that would double-count operational costs).

No migration or backfill from EVM into `ProjectCostAllocation` in P2-1.x.
