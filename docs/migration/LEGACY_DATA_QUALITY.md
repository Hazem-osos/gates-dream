# Legacy Data Quality Analysis

**Phase 0.5:** **CONFIRMED_FROM_DB** (`LegacyForensic` / Agro2).

## Summary

| Severity | Count |
|----------|------:|
| Critical | 1 |
| High | 2 |
| Medium | 2 |
| Low | 2 |

## Issues

| ISSUE | COUNT | MODULE | SEVERITY | AUTO? | OWNER? | BLOCKER? |
|-------|------:|--------|----------|-------|--------|----------|
| GL line `AccountNo` not in `Account` master (distinct codes) | **70** codes / **~3,666** lines | M1 | **Critical** | No | Yes — create missing COA rows or map to parent | **Yes** for naive FK import |
| GL lines with blank `AccountNo` | **60** | M1 | Medium | Flag | No | Partial |
| GL lines matching `Account` | **541** | M1 | — | — | — | — |
| Duplicate `(CompanyCode, AccountCode)` | **0** | M1 | — | — | — | — |
| Posted TB imbalance | **0** vouchers | M1 | — | — | — | — |
| **ItemStore** empty (no cached qty) | **0** rows | M4 | High | Use `StoreTransDetail` + `ItemCost` | No | No for this DB |
| ItemsFirstTime opening docs | **0** | M4 | — | — | — | — |
| BalanceAccounts batch | **1** H / **1** D | M1 | Medium | Dedup vs GL type `BG01` (1 posted) | Yes | No |
| Invoices NULL status | **23** | M15 | Low | Map to draft | No | No |
| Invoice posted without `GLNum` | **2** (128 posted, 126 with GL) | M15 | Medium | Import policy | Yes | No |

## Notes

- **Orphan GL accounts** are likely **detail-level account numbers** (e.g. `1020102001`) while `Account` holds **shorter tree codes** (`003`–`007`). Migration must either import full COA from GL distinct accounts or resolve hierarchy — not a simple bug fix.
- TB is **balanced** at base amounts despite COA join gaps.
