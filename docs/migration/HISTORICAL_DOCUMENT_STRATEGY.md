# Historical Document Strategy

**Question:** Should legacy invoices, cash, transfers, and manufacturing docs migrate as operational documents, read-only history, or opening balances only?

---

## 1. Evidence from new ERP

| Document | Posting entry | Side effects if treated as “new” |
|----------|---------------|----------------------------------|
| `Invoice` | `invoice-posting-orchestrator` | GL, stock, party caches, numbering |
| `JournalEntry` | `journal-posting.service` | Party/treasury card columns, balances |
| `OpeningStock` | `opening-stock.service` | Movements + GL |
| `Transfer` / receipts / issues |各自的 posting services | Movements + GL |
| POS orders | `pos-order-posting.service` | GL + stock |

**Constitution:** Posting is not idempotent by default — re-running post on migrated rows **duplicates** economic effect.

---

## 2. Legacy document model

- Headers: `Status` (`Post`/`UnPost`), `Deleted`, `GLNum` link to `GLTrxHeader`.
- Invoices: `AffectStore`, payment fields, returns linked by `ReturnInvoiceNum`.
- Posting centralized in Delphi + SPs (`PostInvoice`, etc.) — exact steps unknown without procedure bodies.

---

## 3. Strategy options

### FULL_OPERATIONAL_HISTORY

Import documents as normal entities; set `isPosted=true` **without** invoking posting services; pre-create GL/stock rows to match legacy.

| Pros | Cons |
|------|------|
| Full UI history | Must perfectly mirror posted state; unpost in UI could break migrated truth |
| | Highest implementation cost |

### READ_ONLY_HISTORY (recommended for invoices/cash/store)

Import headers/lines for search and print; flag `source='legacy'` / `locked=true` (field TBD); **no** unpost; GL already in `JournalEntry`.

| Pros | Cons |
|------|------|
| Avoid double post | Product may not have lock UI yet — needs engine + API guard |
| Aligns with GL-first | Stock qty may not tie to invoice lines unless movements imported |

### OPENING_BALANCE_ONLY

No historical invoices; only TB + stock snapshot.

| Pros | Cons |
|------|------|
| Safest | Users lose document drill-down |

### MIXED (recommended program)

| Domain | Strategy |
|--------|----------|
| GL (`GLTrx*`) | FULL operational **state** (posted JE rows), not re-postable |
| Invoices | READ_ONLY_HISTORY + link `GLNum` |
| Cash/Cheques | READ_ONLY or OPENING until treasury ETL ready |
| Store transactions | OPENING + optional READ_ONLY for recent period |
| POS | Usually **IGNORE** legacy (new POS) or OPENING sales summary |

---

## 4. Consequences

| If migrate invoice as postable new invoice | Duplicate GL if Phase C already imported same `GLNum` |
| If user unposts migrated invoice | Could reverse stock/GL incorrectly unless blocked |
| If skip invoices but import GL | TB correct; invoice reports empty |
| If import unposted legacy only | TB wrong vs business expectation |

---

## 5. Recommendation

1. **Pilot:** GL Phase C + masters + opening stock snapshot; invoices **READ_ONLY_HISTORY** with `isPosted` copied, posting orchestrator **skipped**, unpost **disabled** for `legacyGlNum != null` or `migrationJobId` set.
2. **Expand:** Treasury Phase D with same pattern.
3. **Defer:** HR, schools, real estate, car modules.

**Confidence:** **MEDIUM** — requires product guardrails not fully in schema yet.

**Alternatives:** OPENING_ONLY for fastest go-live; FULL_OPERATIONAL only after mixed strategy proven on staging.
