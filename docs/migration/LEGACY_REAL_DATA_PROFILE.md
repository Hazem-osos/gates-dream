# Legacy Real Data Profile

**Source:** `LegacyForensic` restored backup (Agro2). **CONFIRMED_FROM_DB**.

## Scale

| Metric | Value |
|--------|------:|
| **Total rows** (all user tables, `sys.partitions`) | **31,721** |
| Tables with data | **120** |
| Empty tables | **449** |
| Largest table | `LangLabelCaptions` (11,797 rows) |

**Workload class:** **SMALL** — entire DB fits in memory; batch size 500 is ample.

## Row buckets (tables)

| Bucket | Definition | Count of tables |
|--------|------------|----------------:|
| EMPTY | 0 rows | 449 |
| SMALL | 1–999 | ~115 |
| MEDIUM | 1,000–99,999 | 5 (`LangLabelCaptions`, `Trace`, `GLTrxDetail`, `HiddenScreen`, `LangMessages`) |
| LARGE | ≥100k | **0** |
| VERY_LARGE | ≥1M | **0** |

## Top 15 tables by row count

| Table | Rows |
|-------|-----:|
| LangLabelCaptions | 11,797 |
| Trace | 4,650 |
| GLTrxDetail | 4,267 |
| HiddenScreen | 2,488 |
| LangMessages | 2,422 |
| LangReportCaptions | 2,017 |
| CompanySetting | 860 |
| ActionsHistory | 290 |
| LangFormsTitles | 280 |
| GLTrxHeader | 264 |
| Countries | 249 |
| InvoiceTrxDetail | 199 |
| InvoiceTrxHeader | 158 |
| Account | 136 |
| InvoiceTrxDistCash | 129 |

## Migration-critical counts

| Table | Rows |
|-------|-----:|
| GLTrxHeader | 264 |
| GLTrxDetail | 4,267 |
| InvoiceTrxHeader | 158 |
| InvoiceTrxDetail | 199 |
| Item | 32 |
| **ItemStore** | **0** |
| Store | 5 |
| Customer | 6 |
| Supplier | 1 |
| Account | 136 |
| CashTrxHeader | 60 |
| StoreTransHeader | 17 |
| StoreTransDetail | 48 |
| ItemsFirstTimeH/D | **0 / 0** |
| BalanceAccountsH/D | **1 / 1** |
| ItemCost | 62 |

## Tenancy

| CompanyCode | Name (AR) |
|-------------|-------------|
| **0001** | شركة جباليا للتنميه الزراعيه |

**Single company** in this backup — one `targetCompanyId` per migration job maps cleanly.

## Performance notes

No table exceeds 12k rows. Node memory limits are not a concern for this dataset. Production customers may differ by orders of magnitude.
