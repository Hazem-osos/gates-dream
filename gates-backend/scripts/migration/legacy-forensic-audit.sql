/* Gates legacy forensic audit — READ-ONLY SELECTs only.
   Run via run-legacy-forensic-audit.mjs (tags: --section=metadata|counts|accounting|inventory|quality)
*/

-- @@SECTION metadata_identity
SELECT DB_NAME() AS database_name, @@VERSION AS sql_version;

SELECT COUNT(*) AS table_count
FROM sys.tables t
WHERE t.is_ms_shipped = 0;

-- @@SECTION metadata_pks
SELECT s.name AS schema_name, t.name AS table_name, i.name AS pk_name,
       STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS pk_columns
FROM sys.tables t
JOIN sys.indexes i ON i.object_id = t.object_id AND i.is_primary_key = 1
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0
GROUP BY s.name, t.name, i.name
ORDER BY t.name;

-- @@SECTION metadata_fks
SELECT fk.name AS fk_name,
       OBJECT_SCHEMA_NAME(fk.parent_object_id) AS parent_schema,
       OBJECT_NAME(fk.parent_object_id) AS parent_table,
       STRING_AGG(pc.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS parent_cols,
       OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS ref_schema,
       OBJECT_NAME(fk.referenced_object_id) AS ref_table,
       STRING_AGG(rc.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS ref_cols
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
GROUP BY fk.name, fk.parent_object_id, fk.referenced_object_id
ORDER BY parent_table;

-- @@SECTION metadata_programmability
SELECT o.type_desc, o.name, LEN(m.definition) AS def_len,
       CASE WHEN m.definition IS NULL THEN 0 ELSE 1 END AS has_body
FROM sys.objects o
LEFT JOIN sys.sql_modules m ON m.object_id = o.object_id
WHERE o.type IN ('P','V','FN','IF','TF','TR')
ORDER BY o.type_desc, o.name;

-- @@SECTION companies
IF OBJECT_ID('dbo.Company') IS NOT NULL
  SELECT CompanyCode, COUNT(*) OVER() AS company_rows FROM dbo.Company;
ELSE
  SELECT 'MISSING_TABLE' AS CompanyCode, 0 AS company_rows;

-- @@SECTION rowcounts_all
;WITH t AS (
  SELECT s.name AS schema_name, o.name AS table_name, SUM(p.rows) AS row_count
  FROM sys.tables o
  JOIN sys.schemas s ON s.schema_id = o.schema_id
  JOIN sys.partitions p ON p.object_id = o.object_id AND p.index_id IN (0,1)
  WHERE o.is_ms_shipped = 0
  GROUP BY s.name, o.name
)
SELECT * FROM t ORDER BY row_count DESC;

-- @@SECTION rowcounts_critical
SELECT 'GLTrxHeader' AS tbl, COUNT(*) AS cnt FROM dbo.GLTrxHeader WHERE 1=1
UNION ALL SELECT 'GLTrxDetail', COUNT(*) FROM dbo.GLTrxDetail
UNION ALL SELECT 'InvoiceTrxHeader', COUNT(*) FROM dbo.InvoiceTrxHeader
UNION ALL SELECT 'InvoiceTrxDetail', COUNT(*) FROM dbo.InvoiceTrxDetail
UNION ALL SELECT 'Item', COUNT(*) FROM dbo.Item
UNION ALL SELECT 'ItemStore', COUNT(*) FROM dbo.ItemStore
UNION ALL SELECT 'Store', COUNT(*) FROM dbo.Store
UNION ALL SELECT 'Customer', COUNT(*) FROM dbo.Customer
UNION ALL SELECT 'Supplier', COUNT(*) FROM dbo.Supplier
UNION ALL SELECT 'Account', COUNT(*) FROM dbo.Account
UNION ALL SELECT 'CashTrxHeader', COUNT(*) FROM dbo.CashTrxHeader
UNION ALL SELECT 'StoreTransHeader', COUNT(*) FROM dbo.StoreTransHeader
UNION ALL SELECT 'ItemsFirstTimeH', COUNT(*) FROM dbo.ItemsFirstTimeH
UNION ALL SELECT 'ItemsFirstTimeD', COUNT(*) FROM dbo.ItemsFirstTimeD
UNION ALL SELECT 'BalanceAccountsH', COUNT(*) FROM dbo.BalanceAccountsH
UNION ALL SELECT 'BalanceAccountsD', COUNT(*) FROM dbo.BalanceAccountsD;

-- @@SECTION accounting_summary
SELECT
  SUM(CASE WHEN UPPER(RTRIM(Status)) = 'POST' AND ISNULL(Deleted,'F') <> 'T' THEN 1 ELSE 0 END) AS posted_headers,
  SUM(CASE WHEN UPPER(RTRIM(Status)) <> 'POST' AND ISNULL(Deleted,'F') <> 'T' THEN 1 ELSE 0 END) AS draft_headers,
  SUM(CASE WHEN ISNULL(Deleted,'F') = 'T' THEN 1 ELSE 0 END) AS deleted_headers
FROM dbo.GLTrxHeader;

SELECT
  SUM(CASE WHEN h.Status = 'Post' AND ISNULL(h.Deleted,'F') <> 'T' THEN d.DebitValue * ISNULL(d.Change,1) ELSE 0 END) AS total_debit_base,
  SUM(CASE WHEN h.Status = 'Post' AND ISNULL(h.Deleted,'F') <> 'T' THEN d.CreditValue * ISNULL(d.Change,1) ELSE 0 END) AS total_credit_base
FROM dbo.GLTrxHeader h
JOIN dbo.GLTrxDetail d ON d.CompanyCode = h.CompanyCode AND d.BranchCode = h.BranchCode
  AND d.YearID = h.YearID AND d.GLNum = h.GlNum;

-- @@SECTION accounting_unbalanced_posted
SELECT h.CompanyCode, h.BranchCode, h.YearID, h.GlNum,
       SUM(d.DebitValue * ISNULL(d.Change,1)) AS deb,
       SUM(d.CreditValue * ISNULL(d.Change,1)) AS cred,
       SUM((d.DebitValue - d.CreditValue) * ISNULL(d.Change,1)) AS diff
FROM dbo.GLTrxHeader h
JOIN dbo.GLTrxDetail d ON d.CompanyCode = h.CompanyCode AND d.BranchCode = h.BranchCode
  AND d.YearID = h.YearID AND d.GLNum = h.GlNum
WHERE UPPER(RTRIM(h.Status)) = 'POST' AND ISNULL(h.Deleted,'F') <> 'T'
GROUP BY h.CompanyCode, h.BranchCode, h.YearID, h.GlNum
HAVING ABS(SUM((d.DebitValue - d.CreditValue) * ISNULL(d.Change,1))) > 0.01;

-- @@SECTION opening_dedup_gl_vs_balance
SELECT 'BalanceAccountsH' AS src, COUNT(*) AS cnt FROM dbo.BalanceAccountsH
UNION ALL SELECT 'ItemsFirstTimeH', COUNT(*) FROM dbo.ItemsFirstTimeH
UNION ALL SELECT 'GL_opening_type', COUNT(*) FROM dbo.GLTrxHeader WHERE Type LIKE '%open%' OR Type LIKE '%Open%' OR Type LIKE '%OPEN%';

-- @@SECTION inventory_itemstore_vs_movements
-- Movement-derived qty from StoreTransDetail (if table exists); compare to ItemStore
IF OBJECT_ID('dbo.StoreTransDetail') IS NOT NULL AND OBJECT_ID('dbo.ItemStore') IS NOT NULL
BEGIN
  ;WITH mov AS (
    SELECT CompanyCode, ItemCode, StoreCode, SUM(ISNULL(TransMainQty, Qty)) AS mov_qty
    FROM dbo.StoreTransDetail
    GROUP BY CompanyCode, ItemCode, StoreCode
  )
  SELECT
    COUNT(*) AS pairs_compared,
    SUM(CASE WHEN ABS(ISNULL(s.Qty,0) - ISNULL(m.mov_qty,0)) < 0.0001 THEN 1 ELSE 0 END) AS exact_match,
    SUM(CASE WHEN ABS(ISNULL(s.Qty,0) - ISNULL(m.mov_qty,0)) >= 0.0001 THEN 1 ELSE 0 END) AS mismatch
  FROM dbo.ItemStore s
  FULL OUTER JOIN mov m ON m.CompanyCode = s.CompanyCode AND m.ItemCode = s.ItemCode AND m.StoreCode = s.StoreCode;
END

-- @@SECTION quality_orphans_gl
SELECT COUNT(*) AS orphan_gl_lines
FROM dbo.GLTrxDetail d
LEFT JOIN dbo.Account a ON a.CompanyCode = d.CompanyCode AND a.AccountCode = d.AccountNo
WHERE a.AccountCode IS NULL;

-- @@SECTION quality_duplicate_accounts
SELECT CompanyCode, AccountCode, COUNT(*) AS dup
FROM dbo.Account
GROUP BY CompanyCode, AccountCode
HAVING COUNT(*) > 1;
