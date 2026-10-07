# Existing ETL (Phases A–D) vs Real Database (Agro2)

| Phase | Classification | Evidence |
|-------|----------------|----------|
| **A** masters | **SUPPORTED_BY_REAL_DATA** | All phase-A tables exist with expected columns; Company `0001`, 136 accounts, 32 items, 5 stores |
| **A** `Account.isActive` from `Deleted` | **PARTIALLY_CORRECT** | OK for master rows; **70** GL account codes lack master row |
| **B** `ItemStore` | **DANGEROUS** as qty source | **0** rows — must use `StoreTransDetail` / posting replay |
| **B** `ItemCost` | **SUPPORTED** | 62 rows |
| **C** `GLTrx*` | **SUPPORTED** | 264/4267 rows; TB balanced; join `GLNum`/`GlNum` casing handled in transformer |
| **C** `InvoiceTrx*` | **PARTIALLY_CORRECT** | 158 headers; 23 NULL status need mapping; field `TotalAmount` vs transformer aliases |
| **C** `CashTrxHeader` | **SUPPORTED** (read) | 60 rows; writer not implemented |
| **D** cheques | **UNKNOWN** | `CKTrxDetail` 9 rows — low priority |

**GLTrxHeader.Performed:** Present in DB/posting logic — **not** mapped in current `transformJournalHeader` — **INCORRECT** for parity with `PostInvoice` checks (add read-only flag or ignore if importing posted state only).
