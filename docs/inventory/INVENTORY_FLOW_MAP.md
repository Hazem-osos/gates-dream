# Gates ERP — Inventory flow maps (Mermaid)

Read-only architecture diagrams. Pair with `INVENTORY_LOGIC_COMPLETE.md`.

---

## Complete inventory architecture

```mermaid
flowchart TB
  subgraph UI["gates-web /inventory"]
    MD[Master data: items, stores, categories, units]
    OPS[Operations: invoices, receipts, transfers, stocktaking]
    RPT[Reports]
  end

  subgraph API["gates-backend /api/v1/inventory/*"]
    RT[Routes: item, warehouse, invoice, receipts, issues, transfers, stocktaking, reports, wave0]
  end

  subgraph Core["Inventory core services"]
    SMS[stockMovementService.postMovementInTx]
    ICS[inventoryCostingService]
    ICSM[inventory-costing-math MAC]
    SQS[stockQueryService]
    SMGL[stockMovementGlService]
  end

  subgraph Data["MySQL / Prisma"]
    IM[(inventory_movements)]
    IQ[(item_quantities)]
    IWB[(item_warehouse_balances)]
    ICH[(item_cost_history)]
    IT[(items)]
  end

  subgraph External["Adjacent modules"]
    INV_POST[invoice-posting-orchestrator]
    POS[pos-order-posting.service]
    MFG[production-order.service]
    ACC[journal-posting / auto-gl]
  end

  UI --> API
  API --> OPS
  OPS --> SMS
  INV_POST --> ICS --> SMS
  POS --> ICS
  MFG --> SMS
  SMS --> IM
  SMS --> IQ
  SMS --> IWB
  ICS --> ICH
  ICS --> IT
  SMGL --> ACC
  RPT --> SQS
  SQS --> IWB
  SQS --> IM
```

---

## Purchase flow

```mermaid
sequenceDiagram
  participant U as User
  participant FE as final-purchase-invoice page
  participant API as /inventory/invoices
  participant POST as invoice-posting-orchestrator
  participant COST as inventoryCostingService
  participant STK as stockMovementService
  participant GL as autoGlPostingService

  U->>FE: Save draft
  FE->>API: POST/PATCH invoice isPosted=false
  U->>FE: Post
  FE->>API: POST .../post
  API->>POST: postInvoiceInTransaction
  POST->>POST: claim isPosted (version lock)
  loop Each purchase line
    POST->>COST: applyInboundMovement PURCHASE
    COST->>STK: postMovementInTx +qty
    STK->>STK: InventoryMovement + ItemQuantity + ItemWarehouseBalance
    COST->>COST: item_cost_history + items.averageCost
  end
  POST->>GL: Supplier / inventory / tax journals
```

---

## Sale flow

```mermaid
sequenceDiagram
  participant U as User
  participant FE as sales-invoice page
  participant POST as invoice-posting-orchestrator
  participant COST as inventoryCostingService
  participant STK as stockMovementService
  participant GL as autoGlPostingService

  U->>FE: Post sales invoice
  FE->>POST: post with stock lock order
  POST->>POST: getCostsAsOf for outbound items
  loop Each line affectStore
    POST->>COST: applyOutboundMovement SALE
    COST->>STK: postMovementInTx -qty
    COST->>POST: COGS valuation buckets
  end
  POST->>GL: Customer, revenue, inventory credit, COGS debit
```

---

## Transfer flow

```mermaid
flowchart LR
  A[Warehouse A] -->|TRANSFER_OUT -qty MAC| T[Transfer document post]
  T -->|TRANSFER_IN +qty same unit cost| B[Warehouse B]
  T --> J{Same inventory GL account?}
  J -->|No| GL[postTransferValueGlInTx]
  J -->|Yes| SKIP[GL may skip value entry]
```

---

## Stocktaking flow

```mermaid
flowchart TD
  ST[Create Stocktaking draft] --> L[Lines: bookQuantity + actualQuantity]
  L --> P[Post stocktaking]
  P --> D{actual - book}
  D -->|> 0 surplus| IN[applyInboundMovement ADJUSTMENT_POSITIVE]
  D -->|< 0 shortage| OUT[applyOutboundMovement ADJUSTMENT_NEGATIVE]
  D -->|= 0| SKIP[No movement]
  IN --> GL[postStocktakingVarianceGlInTx optional]
  OUT --> GL
```

---

## Return flow (sales)

```mermaid
sequenceDiagram
  participant SR as sales-returns invoice
  participant POST as invoice-posting-orchestrator
  participant COST as inventoryCostingService

  SR->>POST: SALE_RETURN post
  POST->>COST: applyInboundMovement RETURN_SALE
  Note over COST: unitCost from original line unitCostAtIssue when linked
  COST->>COST: Reverse COGS buckets + stock IN
```

---

## Accounting integration (simplified)

```mermaid
flowchart TB
  DOC[Inventory-affecting document]
  DOC --> STOCK[stockMovementService / inventoryCostingService]
  DOC --> GLPATH{GL context provided?}
  GLPATH -->|Yes| SMGL[stockMovementGlService or invoice GL]
  GLPATH -->|No| SKIP[Stock only — e.g. some integrations]
  SMGL --> JE[JournalEntry + lines]
  JE --> LB[ledger balances]
```

---

## Quantity source-of-truth

```mermaid
flowchart LR
  subgraph Current["Current on-hand (today)"]
    IWB[item_warehouse_balances.quantityOnHand]
    IQ[item_quantities per location]
  end

  subgraph Historical["As-of date"]
    IM_SUM[SUM inventory_movements.quantityDelta]
  end

  subgraph Audit["Audit trail"]
    IM_ROW[inventory_movements rows]
  end

  POST[postMovementInTx] --> IM_ROW
  POST --> IQ
  POST --> IWB

  API_LIVE[stockQueryService.getWarehouseQuantity] --> IWB
  API_LIVE --> IQ
  API_ASOF[getCompanyItemQuantityAsOf] --> IM_SUM
```

---

## Costing flow (MAC)

```mermaid
flowchart TD
  IN[Inbound movement] --> MAC[computeMovingAverageCost]
  MAC --> WH[item_warehouse_balances.averageCost]
  MAC --> GLOB[items.averageCost via syncItemValuation]
  MAC --> HIST[item_cost_history row]
  OUT[Outbound movement] --> COGS[unitCost = snapshot MAC]
  COGS --> IM[outbound movement.unitCost]
  REPAIR[recalculateItemCostHistory] --> REPLAY[replayItemCostHistory chronological]
```
