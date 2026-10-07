# Owner Decisions Required

Only decisions **not** fully determined by repository evidence.

## Phase 0.5 status (Agro2 restored)

| Question | Status |
|----------|--------|
| Historical invoices vs GL-first | **ANSWERED_BY_DATABASE_EVIDENCE** → Strategy **B** (126/128 posted have GLNum) |
| ItemStore as qty source | **ANSWERED** → **0 rows**; use movements |
| TB / unbalanced posted GL | **ANSWERED** → balanced, 0 bad vouchers |
| Opening dedup BalanceAccounts vs GL | **PARTIALLY_ANSWERED** → 1+1 rows + 1 BG01 GL — still need owner on policy |
| Negative stock at cutover | **ANSWERED** for this DB → movement sum -42, no ItemStore negatives |
| Multi-company in backup | **ANSWERED** → single `0001` |
| Module scope (HR/schools) | **ANSWERED** for this DB → empty/low rows; defer |
| GL accounts missing from COA (70 codes) | **NEW — OWNER_DECISION** | Auto-create from GL vs fail import |
| Import 6 draft GL + 23 NULL invoices | **STILL_OWNER_DECISION** | |
| Production customer ≠ Agro2 scale | **STILL_OWNER_DECISION** | Re-run audit on production BACPAC |

**Remaining owner decisions: 4** (down from 10).

---

## 1. Historical commercial documents

| QUESTION | Why it matters | Options | Recommendation | Risk |
|----------|----------------|---------|----------------|------|
| Migrate sales/purchase **invoices** as what? | Double GL/stock if wrong | READ_ONLY / OPENING_ONLY / FULL | READ_ONLY + GL-first | FULL breaks parity |

---

## 2. Opening vs historical GL

| QUESTION | Why | Options | Rec | Risk |
|----------|-----|---------|-----|------|
| Use `BalanceAccounts*` in addition to opening-type `GLTrx`? | Double opening TB | Merge / GL only / Balance batch only | GL only if both exist — dedupe rules | TB wrong |

---

## 3. Cutover date & fiscal year

| QUESTION | Why | Options | Rec | Risk |
|----------|-----|---------|-----|------|
| Migrate **all years** or closed years only? | Volume + UX | All posted / current year + opening / custom range | All posted for pilot if volume OK | Performance |

---

## 4. Stock negative & strict mode

| QUESTION | Why | Options | Rec | Risk |
|----------|-----|---------|-----|------|
| Legacy negative qty at cutover? | Strict inventory blocks ops | Allow negative / adjust to zero / fix in legacy first | Fix in legacy before cutover | Ops blocked |

---

## 5. User / employee login mapping

| QUESTION | Why | Options | Rec | Risk |
|----------|-----|---------|-----|------|
| Migrate `UserDefinition` to live logins? | Security | Map selected users / all / none (new users) | None for pilot; manual invite | Auth chaos |

---

## 6. Multi-warehouse vs single default

| QUESTION | Why | Options | Rec | Risk |
|----------|-----|---------|-----|------|
| Lines with missing `StoreCode`? | Import failures | Reject / default warehouse | Reject — list in dry run | Wrong stock |

---

## 7. Unbalanced posted legacy GL

| QUESTION | Why | Options | Rec | Risk |
|----------|-----|---------|-----|------|
| Allow posted vouchers with `Balanced='F'`? | New ERP may reject | Import as unposted / adjustment JE / exclude | Adjustment JE with approval | TB gap |

---

## 8. Module scope for first customer

| QUESTION | Why | Options | Rec | Risk |
|----------|-----|---------|-----|------|
| Include HR (149 tables), schools, real estate, cars? | Effort | Yes per module / defer | Defer all non-GL/stock/sales masters | Missing features |

---

## 9. Document numbering after cutover

| QUESTION | Why | Options | Rec | Risk |
|----------|-----|---------|-----|------|
| Continue legacy number series for new docs? | Legal/audit | Continue per branch/year / new series | Continue where schema supports | Duplicate numbers |

---

## 10. Consolidation

| QUESTION | Why | Options | Rec | Risk |
|----------|-----|---------|-----|------|
| Multiple legacy `CompanyCode` → one new tenant? | Uniques collide | Forbidden / remap codes | Forbidden | Data corruption |

---

**Count:** **10** decision areas (some with sub-options).

**Evidence that would reduce list:** Restored DB quality report; procedure bodies for posting; pilot customer module checklist.
