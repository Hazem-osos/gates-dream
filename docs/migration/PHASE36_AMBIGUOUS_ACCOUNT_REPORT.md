# GATES MIGRATION ENGINE — PHASE 3.6 AMBIGUOUS ACCOUNT REPORT

## ACCOUNT

**`102060101003`** — not in `dbo.Account`; appears on **2 posted GL lines only** (journals `00000084` / `00000085`).

---

## COMPLETE JOURNAL 00000084

| Field | Value |
|-------|--------|
| Branch | `0001` |
| Year | `00000001` |
| GL | `00000084` |
| Type | **SV99** (POS sale day posting) |
| Date | 2025-10-19 |
| Status | Post |
| SourceNum | `00000004` |

| Line | Account | Master name | Debit | Credit | Description |
|------|---------|-------------|------:|-------:|-------------|
| 0 | `102020101001` | *(no master)* | 60.00 | 0.00 | قيد من يومية نقطة بيع |
| 1 | `401001` | المبيعات | 0.00 | 60.00 | قيد من يومية نقطة بيع |
| 2 | `102020101001` | | 0.00 | 60.00 | |
| 3 | **`102060101003`** | *(no master)* | **60.00** | 0.00 | قيد من يومية نقطة بيع |

**Journal balances:** Σ debit = Σ credit = **120.00** (balanced).

---

## COMPLETE JOURNAL 00000085

| Field | Value |
|-------|--------|
| Type | **SR99** (POS sale return) |
| Date | 2025-10-19 |
| SourceNum | `00000006` |

| Line | Account | Master name | Debit | Credit | CC |
|------|---------|-------------|------:|-------:|-----|
| 0 | `102020101001` | | 0.00 | 24.00 | |
| 1 | `302001` | مردودات مبيعات | 24.00 | 0.00 | `101001` |
| 2 | `102020101001` | | 24.00 | 0.00 | |
| 3 | **`102060101003`** | | 0.00 | **24.00** | |

**Journal balances:** Σ debit = Σ credit = **48.00** (balanced).

---

## COUNTERPART ANALYSIS

### Journal 84 (sale) — economic shape

Peer **normal** SV99 (e.g. `00000073`, 2 lines): Dr walk-in customer `102020101001` / Cr sales `401001`.

**Four-line** SV99 (e.g. `00000213`, `00000091`) adds a **second leg**:

| Leg | Lines 0–1 | Lines 2–3 |
|-----|-----------|-----------|
| Revenue | Dr customer / Cr `401001` | Cr customer / Dr **cash drawer** |

For **`00000213`** (same amounts, same date class): line 3 = **`1020101001`** (خزينه خالد باهي — POS cash safe).

For **`00000084`**: line 3 = **`102060101003`** instead of `1020101001`.

**Net on `102020101001`:** +60 −60 = **0** (clearing account within journal).  
**Net on `401001`:** credit **60** (sales).  
**Net on ambiguous code:** debit **60** — occupies the **cash-collection** slot used elsewhere by `1020101001`.

### Journal 85 (return)

Same 4-line template as **`00000214`** / **`00000215`**, which use **`1020101001`** on line 3.  
**`00000085`** uses **`102060101003`** on line 3 (credit **24**).

---

## POS SOURCE TRACE

| Evidence | Finding |
|----------|---------|
| `RestPOSH` | **0 rows** for company `0001` |
| `MosPosFinishH` | **0 rows** |
| `POSFinish` | 2 shift closes; `ReturnCashValue` **110** on finish `00000002` (not equal to 84 alone) |
| `SourceNum` `00000004` / `00000006` | POS day indices; no separate invoice table row retrieved |
| `CompanySetting` | `CustomersAccount` = `102020101`; `CashTypeSV01` = `BR02`; **no** setting value `102060101003` |
| `CashTypeSV99` | **not** in settings sample |

**Conclusion:** GL is the only persisted trace; POS tables do not name `102060101003`. Posting template is **SV99/SR99** day journals with **4 lines** when cash leg is split.

---

## DATABASE-WIDE REFERENCES

Exact `102060101003`:

| Location | Count |
|----------|------:|
| `GLTrxDetail.AccountNo` (posted) | **2** |
| `dbo.Account` | 0 |
| `Customer` / `Supplier` | 0 |
| `CompanySetting` | 0 |
| `CashTrxDetail` | 0 |

---

## NON-POSTED REFERENCES

**0** lines in any GL status (only posted pair above).

---

## ACCOUNT STRUCTURE EVIDENCE

| Prefix | In master for `0001`? |
|--------|------------------------|
| `10206*` | **No** |
| `102060101*` | **No** |
| `1020101001` | **Yes** — خزينه خالد باهي (under `1020101`) |
| `102020101*` | Customer hierarchy + party codes |

LegacyForensic has **only company `0001`** — no cross-company code comparison.

**Convention (inferred from peers, not from generator source):** 4-line POS journals use **line 3** = branch POS **cash** account under `1020101*`.

---

## OTHER COMPANY EVIDENCE

N/A (single company in forensic DB).

---

## LEGACY CODE / PROCEDURE EVIDENCE

No SQL procedures/views in DB containing `102060101` or `SV99` (object definition search). Delphi sources not in repo.

---

## ACCOUNTING INTERPRETATION

`102060101003` is **not** a defined COA or party account. In context it **fills the POS cash-drawer leg** of a standard 4-line SV99/SR99 template, where all parallel journals use **`1020101001`**.

This is consistent with a **wrong account code on post** (fat-finger / misconfigured cashier account at post time), not a distinct economic subledger.

---

## CONFIDENCE

| Claim | Confidence |
|-------|------------|
| Role = POS cash leg (line 3) | **High** (template match across 5+ journals) |
| Intended code = `1020101001` | **High** (peer journals, same amounts/structure) |
| `102060101003` is intentional master | **None** (no master/config/refs) |

**Overall migration classification:** **SOURCE_DATA_ERROR_CONFIRMED** (erroneous code on 2 posted lines).  
**Recommended correction target (owner approval):** map to **`1020101001`** for GL migration — **not** auto-applied.

---

## PROPOSED TARGET MAPPING (owner approved 2026-10-04)

| Field | Value |
|-------|--------|
| legacyCode | `102060101003` |
| targetAccountCode | `1020101001` |
| reason | Same journal slot as peer SV99/SR99; POS cash safe |
| evidence | Journals `00000084`/`00000085` vs `00000213`/`00000214` |
| confidence | High |
| mappingType | `FORENSIC_EXPLICIT_MAPPING` (pending owner) |

---

## OWNER DECISION NEEDED

**Yes** — approve one of:

1. **Map to `1020101001`** (recommended) — treats lines as mis-posted cash; safe-mapped TB gains **84.00**; no new COA leaf.
2. **Block / exclude** those 2 lines from posted GL import — preserves ambiguity; TB import incomplete.
3. **Create new COA `102060101003`** — **not recommended** (no master semantics; invents account).

---

## IMPACT ON TB

| Scenario | Effect |
|----------|--------|
| Full legacy TB | Unchanged **62,869,333.38** |
| Current safe map | **−84.00** on both sides |
| Map to `1020101001` | Safe map **+84.00** → **full TB** at 49/49 codes |

---

## IMPACT ON PARTY BALANCES

**None** — party migration uses 14-digit customer codes; `102020101001` nets to zero within each journal.

---

## IMPACT ON POS RECONCILIATION

If cash leg is mapped to `1020101001`, POS shift cash totals align with other SV99/SR99; otherwise **84.00** sits off cash drawer.

---

## RECOMMENDED MIGRATION OVERRIDE POLICY

**Implemented (Phase 3.6 owner approval):** table `legacy_account_overrides`, seed catalog in `approved-legacy-account-overrides.ts`, sync via `syncOwnerApprovedPostedGlMappings` after COA (id map outcome `OWNER_APPROVED_MAPPING`).

Add optional **`LegacyAccountOverride`** (design only):

- `sourceCompanyCode`, `legacyAccountCode`, `targetAccountId`, `decisionType` (`SOURCE_DATA_ERROR_CORRECTION` | `OWNER_MAPPING`), `reason`, `approvedBy`, `approvedAt`, `evidenceReference`
- Engine classes: `OWNER_APPROVED_MAPPING` distinct from `DERIVED_SAFE`
- Never auto-apply from inference without approval record

---

## PRODUCTION MODIFIED

**NO**

## LEGACY MODIFIED

**NO**
