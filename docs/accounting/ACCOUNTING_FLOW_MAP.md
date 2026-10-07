# Gates ERP — Accounting Flow Map (read-only audit)

**Scope:** Actual implementation paths as traced in `gates-backend` + `gates-web` (October 2026).  
**Rule:** Diagrams describe **current behavior**, not ideal ERP design.

---

## 1. Core posting pipeline

```mermaid
flowchart TD
  UI[Frontend accounting / inventory / POS pages]
  API[Express routes + tenant + fiscal middleware]
  DOC[Business document service]
  TX[prisma.$transaction]
  CLAIM[Optimistic claim: updateMany isPosted/version]
  BIZ[Stock / party / paper / cash side effects]
  GLBUILD[Line builders: auto-gl / treasury / stock-gl / manual]
  JPS[journalPostingService.createAndPostInTx]
  FY[fiscalYearService.assertOpenForDate]
  CC[glAccountResolver.enforceCostCenters]
  BAL[applyPostedJournalBalancesInTx]
  JE[(journal_entries + journal_entry_lines)]
  CACHE[(account_period_balances + partner_running_balances + card columns)]

  UI --> API --> DOC --> TX
  TX --> CLAIM --> BIZ --> GLBUILD --> JPS
  JPS --> FY --> CC --> JE --> BAL --> CACHE
```

**Authoritative ledger:** Posted, non-cancelled, non-deleted `journal_entry_lines` (`debitBase` / `creditBase`).  
**Caches updated on post/unpost:** `account_period_balances`, `partner_running_balances`, and selectively `customer.balance` / `supplier.balance` / safe & bank card columns (`ledger-balance.service.ts`).

---

## 2. Sales → AR / revenue / tax / COGS / inventory

```mermaid
flowchart LR
  SI[Sales Invoice M5]
  ORCH[invoice-posting-orchestrator.post]
  STK[inventoryCostingService / stockMovementService]
  AGL[autoGlPostingService.commitInTx SI/SR]
  COGS[Optional second JE or grouped COGS lines]
  SETTLE[invoiceSettlementService / split]
  CR[CashTransaction CR/CP]

  SI --> ORCH
  ORCH --> STK
  ORCH --> AGL
  ORCH --> COGS
  ORCH --> SETTLE
  SETTLE --> CR
  AGL --> JE[(Journal)]
  STK --> MOV[(inventory_movements / balances)]
```

**CURRENT:** Stock and GL run in **one transaction** after invoice post claim (`invoice-posting-orchestrator.ts`).  
**GL optional:** `createGl` / transaction settings / `notCreateGL` can skip revenue JE while stock still posts (documented in orchestrator).

---

## 3. Purchases → AP / inventory / tax

```mermaid
flowchart LR
  PI[Purchase Invoice]
  ORCH[invoice-posting-orchestrator]
  STK[+qty MAC inbound]
  AGL[autoGlPostingService PI/PR]
  LC[landed-cost.service optional JEs]

  PI --> ORCH --> STK
  ORCH --> AGL
  PI --> LC
  AGL --> JE[(Journal)]
```

---

## 4. Cash / bank vouchers

```mermaid
flowchart TD
  V[Treasury Receipt/Payment UI]
  CT[cash-transaction.service CRUD]
  TP[treasury-posting.service.postCashTransactionInTx]
  AGL[autoGlPostingService CR/CP]
  JE[Journal]
  SAFE[Safe/Bank balance columns]

  V --> CT --> TP --> AGL --> JE
  TP --> SAFE
```

**Unpost:** `cascadeSourceJournalInTx` + balance inversion (`treasury-posting.service.ts`).

---

## 5. Customer / supplier → documents → GL → statements

```mermaid
flowchart LR
  CARD[Customer/Supplier master]
  BAL_COL[customer.balance / supplier.balance CACHE]
  INV[Invoices + returns]
  VCH[Vouchers + allocations]
  MAN[Manual JE lines partnerId]
  JEL[journal_entry_lines]
  RPT[Statements / aged reports / party-balance-reconciliation]

  CARD --> INV --> JEL
  CARD --> VCH --> JEL
  MAN --> JEL
  JEL --> BAL_COL
  JEL --> RPT
  BAL_COL -.->|compare| RPT
```

---

## 6. Cost center

```mermaid
flowchart LR
  LINE[journal_entry_lines.costCenterId]
  CCM[cost-center-movement.service transfer UI]
  CCR[Cost center reports / ledger]
  STK_CC[stock-movement-gl transfer mirror rows]

  LINE --> CCR
  CCM -->|rewrites costCenterId on lines| LINE
  STK_CC -->|optional CostCenterMovement table| CCR
```

**CURRENT:** Primary analytic axis is **JE line `costCenterId`**. `CostCenterMovement` is auxiliary (stock transfer GL).

---

## 7. Multi-currency

```mermaid
flowchart LR
  DOC[Document currency + rate at save]
  LINE[journal line debit/credit FC]
  BASE[debitBase/creditBase = amount × rate]
  FXSET[Settlement FXDIFF JE optional]
  RPT[Reports mostly base]

  DOC --> LINE --> BASE --> RPT
  DOC --> FXSET --> BASE
```

**Rate capture:** `company-fx-rate.ts` (`rateForSave`, `persistJournalLineFxRate`) at journal create/post; invoice settlement can post `FXDIFF` (`invoice-settlement.service.ts`).

---

## 8. Commercial papers / cheques (dual stacks)

```mermaid
flowchart TD
  SEC[Securities receipt/payment UI]
  CPP[commercial-paper-posting.service]
  CHQ[cheque-lifecycle.service]
  JE[Journal entries]

  SEC --> CPP --> JE
  SEC --> CHQ --> JE
```

**RISK / QUESTION:** Two implementations can both touch cheque lifecycle; callers differ by screen/API path (see risk register).

---

## 9. POS (parallel to sales invoice)

```mermaid
flowchart LR
  POS[POS order post]
  STK[Costing outbound/inbound]
  JPS[journalPostingService.createAndPostInTx single combined JE]
  CUST[customer.balance increment on credit leg]

  POS --> STK --> JPS
  POS --> CUST
```

**Difference from SI:** POS builds one JE in `pos-order-posting.service.ts`; invoices use `autoGlPostingService` + richer line mapping.

---

## 10. Unpost / reverse (sourced documents)

```mermaid
stateDiagram-v2
  [*] --> Draft: create
  Draft --> Posted: createAndPostInTx
  Posted --> Unposted: unpostSourceJournalInTx invert caches
  Unposted --> Posted: repostSourceJournalInTx
  Posted --> Cancelled: cascade cancel + invert
  note right of Posted
    Sourced JEs: no direct edit;
    manual unpostJournalEntry blocked
  end note
```

**CURRENT:** `reverseJournalEntryInTx` for some modules inverts balances **in place** without always creating a visible contra JE row (`journal-posting.service.ts` comments vs `reversalOfJournalEntryId` for explicit reversals).
